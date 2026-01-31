import { NextRequest, NextResponse } from 'next/server'
import {
  generatePostFromNews,
  saveGeneratedPost,
  generatePendingPosts,
} from '@/lib/ai/agents/post-generator'
import { detectBreakingNews, getExpiryTime } from '@/lib/ai/agents/breaking-detector'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { raw_news_id, batch_limit, save = true } = body

    if (raw_news_id) {
      // Generate single post
      const { success, post, error } = await generatePostFromNews(raw_news_id)

      if (!success || !post) {
        return NextResponse.json({ success: false, error }, { status: 400 })
      }

      if (save) {
        const saveResult = await saveGeneratedPost(post)

        // Detect breaking news
        let breakingResult = null
        if (saveResult.success && saveResult.postId) {
          breakingResult = await checkAndSaveBreaking(
            saveResult.postId,
            post.content,
            post.botHandle
          )
        }

        return NextResponse.json({
          success: true,
          post: {
            ...post,
            id: saveResult.postId,
          },
          saved: saveResult.success,
          breaking: breakingResult,
        })
      }

      return NextResponse.json({ success: true, post, saved: false })
    } else {
      // Batch generate
      const limit = batch_limit || 5
      const result = await generatePendingPosts(limit)
      return NextResponse.json(result)
    }
  } catch (error) {
    console.error('Generate post API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  // Check if cron job
  const authHeader = req.headers.get('authorization')
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    // Run batch generation
    try {
      const result = await generatePendingPosts(3)
      return NextResponse.json({ cron: true, ...result })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Generation failed' },
        { status: 500 }
      )
    }
  }

  // Get generation stats
  const supabase = getSupabaseAdmin()

  // Posts per bot
  const { data: bots } = await supabase
    .from('bots')
    .select('id, name, handle, posts_count, avatar_url, color_accent')

  // Recent posts
  const { data: recentPosts } = await supabase
    .from('posts')
    .select(
      `
      id,
      content,
      created_at,
      verification_status,
      bot:bots (name, handle, avatar_url)
    `
    )
    .order('created_at', { ascending: false })
    .limit(10)

  // Pending raw news (not yet posts)
  const { count: pendingCount } = await supabase
    .from('raw_news')
    .select('*', { count: 'exact', head: true })
    .eq('is_processed', false)

  return NextResponse.json({
    bots,
    recent_posts: recentPosts,
    pending_news: pendingCount || 0,
  })
}

// ═══════════════════════════════════════════════════════════════
// BREAKING NEWS DETECTION
// ═══════════════════════════════════════════════════════════════

async function checkAndSaveBreaking(
  postId: string,
  content: string,
  botHandle: string
): Promise<{ isBreaking: boolean; id?: string } | null> {
  try {
    const detection = await detectBreakingNews(content, botHandle)

    if (!detection.isBreaking) {
      return { isBreaking: false }
    }

    const supabase = getSupabaseAdmin()
    const expiresAt = getExpiryTime(detection.urgencyLevel, detection.expiresInMinutes)

    // Mark post as breaking
    await supabase
      .from('posts')
      .update({
        is_breaking: true,
        breaking_detected_at: new Date().toISOString(),
      })
      .eq('id', postId)

    // Insert breaking news record
    const { data, error } = await supabase
      .from('breaking_news')
      .insert({
        post_id: postId,
        headline: detection.headline,
        summary: detection.summary,
        urgency_level: detection.urgencyLevel,
        category: detection.category,
        related_topics: detection.relatedTopics,
        is_active: true,
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single()

    if (error) throw error

    return { isBreaking: true, id: data.id }
  } catch (error) {
    console.error('Breaking detection save error:', error)
    return null
  }
}
