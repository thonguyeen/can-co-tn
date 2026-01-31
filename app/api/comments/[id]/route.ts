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

// GET /api/comments/[id] - Get a single comment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await getSupabase()

  const { data: comment, error } = await supabase
    .from('comments')
    .select(
      `
      id,
      content,
      parent_id,
      post_id,
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
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  return NextResponse.json({ comment })
}

// DELETE /api/comments/[id] - Delete a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await getSupabase()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get comment first to check ownership and get post_id
  const { data: comment, error: fetchError } = await supabase
    .from('comments')
    .select('id, user_id, post_id')
    .eq('id', id)
    .single()

  if (fetchError || !comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  // Only allow user to delete their own comments
  if (comment.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Delete comment
  const { error: deleteError } = await supabase
    .from('comments')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  // Decrement comment count
  await supabase.rpc('decrement_comments', { p_post_id: comment.post_id })

  return NextResponse.json({ success: true })
}
