import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  findMatchesForCan,
  findMatchesForCo,
  saveMatches,
  createMatchBotComment,
  notifyMatchedIntents,
} from '@/lib/engine/matching';
import type { Intent } from '@/lib/engine/types';

// POST /api/matching/trigger — run matching for a specific intent
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const body = await request.json();
    const { intent_id } = body;

    if (!intent_id) {
      return NextResponse.json({ error: 'intent_id required' }, { status: 400 });
    }

    const { data: intent, error } = await supabase
      .from('intents')
      .select('*')
      .eq('id', intent_id)
      .single();

    if (error || !intent) {
      return NextResponse.json({ error: 'Intent not found' }, { status: 404 });
    }

    const typedIntent = intent as Intent;

    // Run matching
    const candidates = typedIntent.type === 'CAN'
      ? await findMatchesForCan(typedIntent, supabase)
      : await findMatchesForCo(typedIntent, supabase);

    // Save matches
    let newMatchCount = 0;
    for (const candidate of candidates) {
      const canId = typedIntent.type === 'CAN' ? typedIntent.id : candidate.intent.id;
      const coId = typedIntent.type === 'CO' ? typedIntent.id : candidate.intent.id;
      const match = await saveMatches(canId, coId, candidate.similarity, candidate.explanation, supabase);
      if (match) newMatchCount++;
    }

    // Update match_count on source intent
    await supabase
      .from('intents')
      .update({ match_count: candidates.length })
      .eq('id', intent_id);

    // Bot comment on source intent
    await createMatchBotComment(intent_id, typedIntent.type as 'CAN' | 'CO', candidates, supabase);

    // Notify matched intents (other side)
    await notifyMatchedIntents(typedIntent.type as 'CAN' | 'CO', candidates, supabase);

    // Create notification for intent owner about matches
    if (candidates.length > 0) {
      await supabase.from('notifications').insert({
        user_id: typedIntent.user_id,
        type: 'match_found',
        title: `Tìm thấy ${candidates.length} match cho nhu cầu của bạn`,
        message: candidates[0].explanation,
        link: `/can-co/intent/${intent_id}`,
      });
    }

    return NextResponse.json({
      matches_found: candidates.length,
      new_matches: newMatchCount,
    });
  } catch (err) {
    console.error('Matching trigger error:', err);
    return NextResponse.json({ error: 'Matching failed' }, { status: 500 });
  }
}
