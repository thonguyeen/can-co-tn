import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore
          }
        },
      },
    }
  )
}

// GET /api/comments?postId=xxx - Get comments for a post
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const postId = searchParams.get('postId')

  if (!postId) {
    return NextResponse.json({ error: 'postId required' }, { status: 400 })
  }

  const supabase = await getSupabase()

  const { data: comments, error } = await supabase
    .from('comments')
    .select(
      `
      id,
      content,
      parent_id,
      created_at,
      user_id,
      bot_id,
      profiles:user_id (
        display_name,
        avatar_url
      ),
      bots:bot_id (
        name,
        handle,
        avatar_url,
        color_accent
      )
    `
    )
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Transform comments to nested structure
  const commentMap = new Map()
  const rootComments: typeof comments = []

  // First pass: create map
  comments?.forEach((comment) => {
    commentMap.set(comment.id, { ...comment, replies: [] })
  })

  // Second pass: build tree
  comments?.forEach((comment) => {
    const commentWithReplies = commentMap.get(comment.id)
    if (comment.parent_id) {
      const parent = commentMap.get(comment.parent_id)
      if (parent) {
        parent.replies.push(commentWithReplies)
      } else {
        // Parent not found, treat as root
        rootComments.push(commentWithReplies)
      }
    } else {
      rootComments.push(commentWithReplies)
    }
  })

  return NextResponse.json({ comments: rootComments })
}

// POST /api/comments - Create a new comment
export async function POST(request: NextRequest) {
  const supabase = await getSupabase()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { postId, content, parentId } = body

  if (!postId || !content) {
    return NextResponse.json(
      { error: 'postId and content required' },
      { status: 400 }
    )
  }

  // Create comment
  const { data: comment, error: insertError } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      user_id: user.id,
      content: content.trim(),
      parent_id: parentId || null,
    })
    .select(
      `
      id,
      content,
      parent_id,
      created_at,
      user_id,
      bot_id,
      profiles:user_id (
        display_name,
        avatar_url
      )
    `
    )
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Increment comment count
  await supabase.rpc('increment_comments', { p_post_id: postId })

  return NextResponse.json({ success: true, comment })
}
