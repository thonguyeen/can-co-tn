import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseSearchIntent, generateIntentTitle, isConfigured as isOpenAIConfigured } from '@/lib/engine/openai';
import {
  generateIntentEmbedding,
  findMatchesForCan,
  findMatchesForCo,
  saveMatches,
  notifyMatchedIntents,
} from '@/lib/engine/matching';
import { orchestrate, executeActions } from '@/lib/agents/orchestrator';
import type { Intent } from '@/lib/engine/types';

/** Fire-and-forget matching trigger (runs in-process, no external fetch needed) */
async function triggerMatching(intentId: string): Promise<void> {
  try {
    const supabase = await createClient();

    const { data: intent } = await supabase
      .from('intents')
      .select('*')
      .eq('id', intentId)
      .single();

    if (!intent) return;

    const typedIntent = intent as Intent;
    const candidates = typedIntent.type === 'CAN'
      ? await findMatchesForCan(typedIntent, supabase)
      : await findMatchesForCo(typedIntent, supabase);

    for (const candidate of candidates) {
      const canId = typedIntent.type === 'CAN' ? typedIntent.id : candidate.intent.id;
      const coId = typedIntent.type === 'CO' ? typedIntent.id : candidate.intent.id;
      await saveMatches(canId, coId, candidate.similarity, candidate.explanation, supabase);
    }

    await supabase
      .from('intents')
      .update({ match_count: candidates.length })
      .eq('id', intentId);

    await notifyMatchedIntents(typedIntent.type as 'CAN' | 'CO', candidates, supabase);

    // Run orchestrator — decides which bots comment (replaces createMatchBotComment)
    const event = candidates.length > 0 ? 'match_found' as const : 'intent_created' as const;
    const actions = await orchestrate(
      { event, intentId, intentData: typedIntent, context: { matchCount: candidates.length, similarCount: candidates.length } },
      supabase,
    );
    if (actions.length > 0) {
      await executeActions(actions, supabase);
    }
  } catch (err) {
    console.error('Auto-matching failed:', err);
  }
}

// GET /api/intents — feed with joins
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const district = searchParams.get('district');
    const status = searchParams.get('status') || 'active';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Fetch intents with images
    let query = supabase
      .from('intents')
      .select('*, intent_images(*)', { count: 'exact' })
      .eq('status', status);

    if (type) query = query.eq('type', type);
    if (category) query = query.eq('category', category);
    if (district) query = query.eq('district', district);

    const { data: intents, count, error } = await query
      .order('trust_score', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!intents || intents.length === 0) {
      return NextResponse.json({ intents: [], total: 0, page, limit });
    }

    // Batch fetch related data
    const intentIds = intents.map((i) => i.id);
    const userIds = [...new Set(intents.map((i) => i.user_id))];

    const [profilesRes, botCommentsRes, latestCommentsRes] = await Promise.all([
      // User profiles
      supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds),
      // Latest bot comment per intent
      supabase
        .from('intent_comments')
        .select('*')
        .in('intent_id', intentIds)
        .eq('is_bot', true)
        .order('created_at', { ascending: false }),
      // Latest human comment per intent
      supabase
        .from('intent_comments')
        .select('*, profiles:user_id(display_name)')
        .in('intent_id', intentIds)
        .eq('is_bot', false)
        .order('created_at', { ascending: false }),
    ]);

    const profilesMap = new Map(
      (profilesRes.data || []).map((p) => [p.id, p]),
    );

    // Get first bot comment per intent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const botCommentMap = new Map<string, any>();
    for (const bc of botCommentsRes.data || []) {
      if (!botCommentMap.has(bc.intent_id)) {
        botCommentMap.set(bc.intent_id, bc);
      }
    }

    // Get first human comment per intent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const latestCommentMap = new Map<string, any>();
    for (const lc of latestCommentsRes.data || []) {
      if (!latestCommentMap.has(lc.intent_id)) {
        latestCommentMap.set(lc.intent_id, lc);
      }
    }

    // Assemble enriched intents
    const enriched = intents.map((intent) => {
      const profile = profilesMap.get(intent.user_id);
      const botComment = botCommentMap.get(intent.id) || null;
      const latestComment = latestCommentMap.get(intent.id) || null;

      return {
        ...intent,
        user: {
          id: intent.user_id,
          name: profile?.display_name || 'Người dùng',
          avatar_url: profile?.avatar_url || null,
          trust_score: intent.trust_score,
          verification_level: intent.verification_level,
        },
        images: intent.intent_images || [],
        bot_comment: botComment,
        latest_comment: latestComment
          ? {
              id: latestComment.id,
              intent_id: latestComment.intent_id,
              content: latestComment.content,
              user_id: latestComment.user_id,
              is_bot: latestComment.is_bot,
              bot_name: latestComment.bot_name,
              created_at: latestComment.created_at,
              user: {
                name: latestComment.profiles?.display_name || 'Người dùng',
              },
            }
          : null,
      };
    });

    return NextResponse.json({ intents: enriched, total: count || 0, page, limit });
  } catch (err) {
    console.error('Feed API error:', err);
    return NextResponse.json({ error: 'Failed to load feed' }, { status: 500 });
  }
}

// POST /api/intents — create intent with AI parsing
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, raw_text, category } = body;

    if (!type || !raw_text) {
      return NextResponse.json({ error: 'type and raw_text are required' }, { status: 400 });
    }
    if (type !== 'CAN' && type !== 'CO') {
      return NextResponse.json({ error: 'type must be CAN or CO' }, { status: 400 });
    }
    if (raw_text.trim().length < 10) {
      return NextResponse.json({ error: 'Vui lòng mô tả ít nhất 10 ký tự' }, { status: 400 });
    }

    // AI parsing (best-effort)
    let parsedData: Record<string, unknown> = {};
    let title = raw_text.slice(0, 80);
    let district: string | null = null;
    let price: number | null = null;
    let priceMin: number | null = null;
    let priceMax: number | null = null;

    if (isOpenAIConfigured()) {
      try {
        const [intent, aiTitle] = await Promise.all([
          parseSearchIntent(raw_text),
          generateIntentTitle(raw_text, type),
        ]);

        title = aiTitle;
        district = intent.districts?.[0] || null;
        if (type === 'CO') {
          price = intent.price_min || intent.price_max || null;
        } else {
          priceMin = intent.price_min || null;
          priceMax = intent.price_max || null;
        }
        parsedData = {
          district: district,
          bedrooms: intent.bedrooms,
          bathrooms: intent.bathrooms,
          area_min: intent.area_min,
          area_max: intent.area_max,
          keywords: intent.keywords,
          preferences: intent.preferences,
        };
      } catch {
        // AI failed — continue with raw text only
      }
    }

    // Use body overrides if provided
    const { data, error } = await supabase
      .from('intents')
      .insert({
        user_id: user.id,
        type,
        raw_text,
        title,
        category: category || 'real_estate',
        price: body.price ?? price,
        price_min: body.price_min ?? priceMin,
        price_max: body.price_max ?? priceMax,
        district: body.district ?? district,
        ward: body.ward || null,
        address: body.address || null,
        lat: body.lat || null,
        lng: body.lng || null,
        parsed_data: body.parsed_data || parsedData,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate embedding + trigger matching (fire-and-forget)
    generateIntentEmbedding(data as Intent, supabase)
      .then(() => {
        // Trigger matching after embedding is ready
        return triggerMatching(data.id);
      })
      .catch((err) => console.error('Post-create pipeline failed:', err));

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('Create intent error:', err);
    return NextResponse.json({ error: 'Không thể đăng, vui lòng thử lại' }, { status: 500 });
  }
}
