import { createClient } from '@supabase/supabase-js'
import {
  rankPosts,
  ScoringContext,
  ScoredPost,
  DEFAULT_WEIGHTS,
  PostForScoring,
} from './scoring'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface FeedOptions {
  userId?: string
  cursor?: string
  limit?: number
  botHandle?: string
  verificationStatus?: string
  timeRange?: 'day' | 'week' | 'month' | 'all'
}

export interface FeedResult {
  posts: ScoredPost[]
  nextCursor: string | null
  hasMore: boolean
  meta: {
    total: number
    filters: {
      botHandle?: string
      verificationStatus?: string
      timeRange?: string
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN FEED FUNCTION
// ═══════════════════════════════════════════════════════════════

export async function getFeed(options: FeedOptions = {}): Promise<FeedResult> {
  const {
    userId,
    cursor,
    limit = 20,
    botHandle,
    verificationStatus,
    timeRange = 'all',
  } = options

  const supabase = getSupabaseAdmin()

  // 1. Build scoring context (personalization data)
  const context = await buildScoringContext(userId)

  // 2. Build base query
  let query = supabase
    .from('posts')
    .select(
      `
      id,
      content,
      created_at,
      updated_at,
      verification_status,
      verification_note,
      likes_count,
      comments_count,
      saves_count,
      sources,
      bot_id,
      bots (
        id,
        name,
        handle,
        avatar_url,
        color_accent,
        expertise
      )
    `
    )
    .order('created_at', { ascending: false })

  // 3. Apply filters
  if (botHandle) {
    const { data: bot } = await supabase
      .from('bots')
      .select('id')
      .eq('handle', botHandle)
      .single()

    if (bot) {
      query = query.eq('bot_id', bot.id)
    }
  }

  if (verificationStatus) {
    query = query.eq('verification_status', verificationStatus)
  }

  if (timeRange !== 'all') {
    const since = getTimeRangeSince(timeRange)
    query = query.gte('created_at', since.toISOString())
  }

  // 4. Fetch more posts than needed for proper ranking after scoring
  const fetchLimit = limit * 3

  const { data: posts, error } = await query.limit(fetchLimit)

  if (error) {
    throw new Error(`Failed to fetch feed: ${error.message}`)
  }

  if (!posts || posts.length === 0) {
    return {
      posts: [],
      nextCursor: null,
      hasMore: false,
      meta: { total: 0, filters: { botHandle, verificationStatus, timeRange } },
    }
  }

  // 5. Score and rank posts
  const rankedPosts = rankPosts(posts as unknown as PostForScoring[], context)

  // 6. Apply cursor-based pagination
  let startIndex = 0
  if (cursor) {
    const cursorIndex = rankedPosts.findIndex((p) => p.id === cursor)
    if (cursorIndex !== -1) {
      startIndex = cursorIndex + 1
    }
  }

  const paginatedPosts = rankedPosts.slice(startIndex, startIndex + limit)
  const hasMore = startIndex + limit < rankedPosts.length
  const nextCursor = hasMore
    ? paginatedPosts[paginatedPosts.length - 1]?.id
    : null

  return {
    posts: paginatedPosts,
    nextCursor,
    hasMore,
    meta: {
      total: rankedPosts.length,
      filters: { botHandle, verificationStatus, timeRange },
    },
  }
}

// ═══════════════════════════════════════════════════════════════
// SCORING CONTEXT BUILDER
// ═══════════════════════════════════════════════════════════════

async function buildScoringContext(userId?: string): Promise<ScoringContext> {
  const context: ScoringContext = {
    followedBotIds: new Set(),
    interactedPostIds: new Set(),
    weights: DEFAULT_WEIGHTS,
  }

  if (!userId) {
    return context
  }

  const supabase = getSupabaseAdmin()

  // Get followed bots
  const { data: follows } = await supabase
    .from('follows')
    .select('bot_id')
    .eq('user_id', userId)

  if (follows) {
    follows.forEach((f) => context.followedBotIds.add(f.bot_id))
  }

  // Get interacted posts (liked, saved, commented)
  const { data: likes } = await supabase
    .from('likes')
    .select('post_id')
    .eq('user_id', userId)

  const { data: saves } = await supabase
    .from('saves')
    .select('post_id')
    .eq('user_id', userId)

  const { data: comments } = await supabase
    .from('comments')
    .select('post_id')
    .eq('user_id', userId)

  ;[likes, saves, comments].forEach((items) => {
    items?.forEach((item) => context.interactedPostIds.add(item.post_id))
  })

  return context
}

// ═══════════════════════════════════════════════════════════════
// TRENDING POSTS
// ═══════════════════════════════════════════════════════════════

export async function getTrendingPosts(limit: number = 5): Promise<ScoredPost[]> {
  const supabase = getSupabaseAdmin()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const { data: posts } = await supabase
    .from('posts')
    .select(
      `
      id,
      content,
      created_at,
      verification_status,
      likes_count,
      comments_count,
      saves_count,
      bot_id,
      bots (name, handle, avatar_url, color_accent)
    `
    )
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(50)

  if (!posts || posts.length === 0) {
    return []
  }

  // Score with engagement-heavy weights for trending
  const trendingWeights = {
    ...DEFAULT_WEIGHTS,
    freshness: { ...DEFAULT_WEIGHTS.freshness, halfLifeHours: 6 },
    engagement: { ...DEFAULT_WEIGHTS.engagement, maxMultiplier: 3.0 },
  }

  const context: ScoringContext = {
    followedBotIds: new Set(),
    interactedPostIds: new Set(),
    weights: trendingWeights,
  }

  const ranked = rankPosts(posts as unknown as PostForScoring[], context)

  return ranked.slice(0, limit)
}

// ═══════════════════════════════════════════════════════════════
// FOR YOU FEED (Personalized)
// ═══════════════════════════════════════════════════════════════

export async function getForYouFeed(
  userId: string,
  options: Omit<FeedOptions, 'userId'> = {}
): Promise<FeedResult> {
  return getFeed({ ...options, userId })
}

// ═══════════════════════════════════════════════════════════════
// FOLLOWING FEED (Only from followed bots)
// ═══════════════════════════════════════════════════════════════

export async function getFollowingFeed(
  userId: string,
  options: Omit<FeedOptions, 'userId'> = {}
): Promise<FeedResult> {
  const supabase = getSupabaseAdmin()

  // Get followed bot IDs
  const { data: follows } = await supabase
    .from('follows')
    .select('bot_id')
    .eq('user_id', userId)

  if (!follows || follows.length === 0) {
    return {
      posts: [],
      nextCursor: null,
      hasMore: false,
      meta: { total: 0, filters: {} },
    }
  }

  const botIds = follows.map((f) => f.bot_id)

  const { cursor, limit = 20, timeRange = 'all' } = options

  let query = supabase
    .from('posts')
    .select(
      `
      id,
      content,
      created_at,
      verification_status,
      verification_note,
      likes_count,
      comments_count,
      saves_count,
      sources,
      bot_id,
      bots (id, name, handle, avatar_url, color_accent, expertise)
    `
    )
    .in('bot_id', botIds)
    .order('created_at', { ascending: false })

  if (timeRange !== 'all') {
    const since = getTimeRangeSince(timeRange)
    query = query.gte('created_at', since.toISOString())
  }

  const { data: posts } = await query.limit(limit * 2)

  if (!posts) {
    return {
      posts: [],
      nextCursor: null,
      hasMore: false,
      meta: { total: 0, filters: {} },
    }
  }

  const context = await buildScoringContext(userId)
  const ranked = rankPosts(posts as unknown as PostForScoring[], context)

  let startIndex = 0
  if (cursor) {
    const idx = ranked.findIndex((p) => p.id === cursor)
    if (idx !== -1) startIndex = idx + 1
  }

  const paginated = ranked.slice(startIndex, startIndex + limit)
  const hasMore = startIndex + limit < ranked.length

  return {
    posts: paginated,
    nextCursor: hasMore ? paginated[paginated.length - 1]?.id : null,
    hasMore,
    meta: { total: ranked.length, filters: { timeRange } },
  }
}

function getTimeRangeSince(range: string): Date {
  const now = new Date()
  switch (range) {
    case 'day':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000)
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    default:
      return new Date(0)
  }
}
