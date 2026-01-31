import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processAndReplyToComment } from '@/lib/ai/agents/reply-agent'
import { generateCrossComments } from '@/lib/ai/agents/bot-interactions'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Rate limiting
let lastRunTime = 0
const MIN_INTERVAL = 30000 // 30 seconds

// GET /api/comments/reply - Get status of pending replies
export async function GET() {
  const supabase = getSupabaseAdmin()

  const { data: pending, error } = await supabase
    .from('pending_replies')
    .select(
      `
      id,
      status,
      created_at,
      processed_at,
      error_message,
      comments:comment_id (
        content,
        profiles:user_id (display_name)
      ),
      bots:bot_id (name, handle)
    `
    )
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get counts by status
  const { data: stats } = await supabase
    .from('pending_replies')
    .select('status')

  const statusCounts = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  }

  stats?.forEach((row) => {
    if (row.status in statusCounts) {
      statusCounts[row.status as keyof typeof statusCounts]++
    }
  })

  return NextResponse.json({
    pending_replies: pending,
    stats: statusCounts,
    last_run: lastRunTime ? new Date(lastRunTime).toISOString() : null,
  })
}

// POST /api/comments/reply - Process pending bot replies (cron job)
export async function POST(request: NextRequest) {
  // Rate limiting
  const now = Date.now()
  if (now - lastRunTime < MIN_INTERVAL) {
    return NextResponse.json(
      { message: 'Rate limited', retry_after: MIN_INTERVAL - (now - lastRunTime) },
      { status: 429 }
    )
  }
  lastRunTime = now

  const supabase = getSupabaseAdmin()
  const body = await request.json().catch(() => ({}))
  const { batch_limit = 5, include_cross_comments = true } = body

  const results: {
    commentId: string
    replyId?: string
    error?: string
  }[] = []

  try {
    // 1. Get pending replies
    const { data: pendingReplies, error: fetchError } = await supabase
      .from('pending_replies')
      .select('id, comment_id, bot_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(batch_limit)

    if (fetchError) {
      throw fetchError
    }

    // 2. Process each pending reply
    for (const pending of pendingReplies || []) {
      // Mark as processing
      await supabase
        .from('pending_replies')
        .update({ status: 'processing' })
        .eq('id', pending.id)

      try {
        // Generate and save reply
        const result = await processAndReplyToComment(pending.comment_id)

        if (result.success) {
          // Mark as completed
          await supabase
            .from('pending_replies')
            .update({
              status: 'completed',
              processed_at: new Date().toISOString(),
            })
            .eq('id', pending.id)

          results.push({
            commentId: pending.comment_id,
            replyId: result.replyId,
          })
        } else {
          throw new Error(result.error || 'Reply generation failed')
        }
      } catch (err) {
        // Mark as failed
        await supabase
          .from('pending_replies')
          .update({
            status: 'failed',
            error_message: err instanceof Error ? err.message : 'Unknown error',
            processed_at: new Date().toISOString(),
          })
          .eq('id', pending.id)

        results.push({
          commentId: pending.comment_id,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }

      // Delay between replies
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    // 3. Process cross-comments for recent bot posts (optional)
    let crossCommentResults = null
    if (include_cross_comments) {
      // Get recent posts without cross-comments
      const { data: recentPosts } = await supabase
        .from('posts')
        .select('id')
        .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(3)

      if (recentPosts && recentPosts.length > 0) {
        // Pick one random post for cross-commenting
        const randomPost = recentPosts[Math.floor(Math.random() * recentPosts.length)]
        crossCommentResults = await generateCrossComments(randomPost.id)
      }
    }

    return NextResponse.json({
      processed: results.filter((r) => r.replyId).length,
      failed: results.filter((r) => r.error).length,
      results,
      cross_comments: crossCommentResults,
    })
  } catch (error) {
    console.error('Reply processing error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    )
  }
}
