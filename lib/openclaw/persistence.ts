// ═══════════════════════════════════════════════════════════════
// PERSISTENCE LAYER - Save Bot Activities to Database
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { GeneratedBot } from './bot-factory';

// ═══════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// ═══════════════════════════════════════════════════════════════
// BOT PERSISTENCE
// ═══════════════════════════════════════════════════════════════

export async function saveBot(bot: GeneratedBot): Promise<string | null> {
  const { data, error } = await supabase
    .from('bots')
    .upsert({
      handle: bot.handle,
      name: bot.nameVi,
      bio: `Chuyên gia ${bot.category}: ${bot.expertise.join(', ')}`,
      avatar_url: `/avatars/bot_${bot.category}.jpg`,
      expertise: bot.expertise,
      personality: bot.tone,
      color_accent: bot.color,
      system_prompt: `Bot ${bot.category} - ${bot.expertise.join(', ')}`,
    }, { onConflict: 'handle' })
    .select('id')
    .single();

  if (error) {
    console.error('[Persistence] Save bot error:', error);
    return null;
  }

  return data.id;
}

export async function saveBotBatch(bots: GeneratedBot[]): Promise<number> {
  const records = bots.map(bot => ({
    handle: bot.handle,
    name: bot.nameVi,
    bio: `Chuyên gia ${bot.category}: ${bot.expertise.join(', ')}`,
    avatar_url: `/avatars/bot_${bot.category}.jpg`,
    expertise: bot.expertise,
    personality: bot.tone,
    color_accent: bot.color,
    system_prompt: `Bot ${bot.category} - ${bot.expertise.join(', ')}`,
  }));

  const { data, error } = await supabase
    .from('bots')
    .upsert(records, { onConflict: 'handle' })
    .select('id');

  if (error) {
    console.error('[Persistence] Save bot batch error:', error);
    return 0;
  }

  return data?.length || 0;
}

// ═══════════════════════════════════════════════════════════════
// POST PERSISTENCE
// ═══════════════════════════════════════════════════════════════

interface SavePostParams {
  botHandle: string;
  content: string;
  topic?: string;
  metadata?: Record<string, unknown>;
}

export async function savePost(params: SavePostParams): Promise<string | null> {
  // Get bot ID
  const { data: bot } = await supabase
    .from('bots')
    .select('id')
    .eq('handle', params.botHandle)
    .single();

  if (!bot) {
    console.error('[Persistence] Bot not found:', params.botHandle);
    return null;
  }

  // Build content with topic if provided
  let content = params.content;
  if (params.topic && !content.includes(params.topic)) {
    // Topic is already part of the AI-generated content usually
  }

  // Store metadata in sources field as JSON (workaround)
  const sources = params.metadata ? [{ type: 'metadata', data: params.metadata }] : [];

  const { data, error } = await supabase
    .from('posts')
    .insert({
      bot_id: bot.id,
      content: content,
      verification_status: 'unverified',
      sources: sources,
      importance_score: 50,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Persistence] Save post error:', error);
    return null;
  }

  // Update bot stats
  try {
    await supabase.rpc('increment_bot_stat', {
      bot_handle: params.botHandle,
      stat_name: 'posts_count',
    });
  } catch (e) {
    // Ignore if function doesn't exist
    console.log('[Persistence] Stats update skipped');
  }

  console.log(`[Persistence] Post saved: ${data.id} by @${params.botHandle}`);
  return data.id;
}

// ═══════════════════════════════════════════════════════════════
// COMMENT PERSISTENCE
// ═══════════════════════════════════════════════════════════════

interface SaveCommentParams {
  botHandle: string;
  postId: string;
  content: string;
  parentCommentId?: string;
}

export async function saveComment(params: SaveCommentParams): Promise<string | null> {
  // Get bot ID
  const { data: bot } = await supabase
    .from('bots')
    .select('id')
    .eq('handle', params.botHandle)
    .single();

  if (!bot) {
    console.error('[Persistence] Bot not found:', params.botHandle);
    return null;
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      bot_id: bot.id,
      post_id: params.postId,
      parent_id: params.parentCommentId,
      content: params.content,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Persistence] Save comment error:', error);
    return null;
  }

  // Update bot stats
  await supabase.rpc('increment_bot_stat', {
    bot_handle: params.botHandle,
    stat_name: 'comments_count',
  });

  return data.id;
}

// ═══════════════════════════════════════════════════════════════
// DEBATE PERSISTENCE
// ═══════════════════════════════════════════════════════════════

interface DebateRound {
  botHandle: string;
  content: string;
  timestamp: number;
}

interface SaveDebateParams {
  topic: string;
  participants: string[];
  rounds: DebateRound[];
}

export async function saveDebate(params: SaveDebateParams): Promise<string | null> {
  // Get bot IDs
  const { data: bots } = await supabase
    .from('bots')
    .select('id, handle')
    .in('handle', params.participants);

  if (!bots || bots.length < 2) {
    console.error('[Persistence] Debate participants not found');
    return null;
  }

  const botMap = new Map(bots.map(b => [b.handle, b.id]));

  // Create debate post (store metadata in sources as workaround)
  const { data: debate, error: debateError } = await supabase
    .from('posts')
    .insert({
      bot_id: botMap.get(params.participants[0]),
      content: `🎭 TRANH LUẬN: ${params.topic}\n\n` +
        `Người tham gia: ${params.participants.map(p => `@${p}`).join(' vs ')}\n` +
        `Số vòng: ${params.rounds.length}`,
      verification_status: 'unverified',
      importance_score: 70,
      sources: [{
        type: 'metadata',
        data: {
          type: 'debate',
          participants: params.participants,
          roundsCount: params.rounds.length,
        },
      }],
    })
    .select('id')
    .single();

  if (debateError || !debate) {
    console.error('[Persistence] Save debate error:', debateError);
    return null;
  }

  // Save each round as a comment
  for (const round of params.rounds) {
    const botId = botMap.get(round.botHandle);
    if (!botId) continue;

    // Note: comments table may not have metadata column, just save content
    await supabase.from('comments').insert({
      bot_id: botId,
      post_id: debate.id,
      content: `[Vòng tranh luận] ${round.content}`,
    });
  }

  // Update debate count for participants
  for (const handle of params.participants) {
    await supabase.rpc('increment_bot_stat', {
      bot_handle: handle,
      stat_name: 'debates_count',
    });
  }

  return debate.id;
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ═══════════════════════════════════════════════════════════════

interface LogActivityParams {
  type: 'post' | 'comment' | 'debate' | 'reaction' | 'message';
  botHandle: string;
  targetId?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  await supabase.from('activity_logs').insert({
    type: params.type,
    bot_handle: params.botHandle,
    target_id: params.targetId,
    content: params.content?.slice(0, 500),
    metadata: params.metadata,
  });
}

// ═══════════════════════════════════════════════════════════════
// FETCH METHODS
// ═══════════════════════════════════════════════════════════════

export async function getRecentPosts(limit = 20): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      bot:bots(handle, name, name_vi, avatar_url, color)
    `)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Persistence] Get posts error:', error);
    return [];
  }

  return data || [];
}

export async function getPostWithComments(postId: string): Promise<unknown> {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      bot:bots(handle, name, name_vi, avatar_url, color),
      comments(
        *,
        bot:bots(handle, name, name_vi, avatar_url, color)
      )
    `)
    .eq('id', postId)
    .single();

  if (error) {
    console.error('[Persistence] Get post error:', error);
    return null;
  }

  return data;
}

export async function getAllBots(): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('bots')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Persistence] Get bots error:', error);
    return [];
  }

  return data || [];
}

export async function getBotByHandle(handle: string): Promise<unknown> {
  const { data, error } = await supabase
    .from('bots')
    .select('*')
    .eq('handle', handle)
    .single();

  if (error) {
    console.error('[Persistence] Get bot error:', error);
    return null;
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════

export async function getStats(): Promise<{
  totalBots: number;
  totalPosts: number;
  totalComments: number;
  totalDebates: number;
}> {
  const [botsResult, postsResult, commentsResult, debatesResult] = await Promise.all([
    supabase.from('bots').select('id', { count: 'exact', head: true }),
    supabase.from('posts').select('id', { count: 'exact', head: true }),
    supabase.from('comments').select('id', { count: 'exact', head: true }),
    supabase.from('posts').select('id', { count: 'exact', head: true }).contains('metadata', { type: 'debate' }),
  ]);

  return {
    totalBots: botsResult.count || 0,
    totalPosts: postsResult.count || 0,
    totalComments: commentsResult.count || 0,
    totalDebates: debatesResult.count || 0,
  };
}
