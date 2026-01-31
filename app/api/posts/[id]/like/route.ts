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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params
  const supabase = await getSupabase()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if already liked
  const { data: existingLike } = await supabase
    .from('likes')
    .select('*')
    .eq('user_id', user.id)
    .eq('post_id', postId)
    .single()

  if (existingLike) {
    return NextResponse.json({ error: 'Already liked' }, { status: 400 })
  }

  // Insert like
  const { error: insertError } = await supabase
    .from('likes')
    .insert({ user_id: user.id, post_id: postId })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Increment likes_count using RPC function
  await supabase.rpc('increment_post_likes', { p_post_id: postId })

  return NextResponse.json({ success: true, liked: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params
  const supabase = await getSupabase()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Delete like
  const { error: deleteError } = await supabase
    .from('likes')
    .delete()
    .eq('user_id', user.id)
    .eq('post_id', postId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  // Decrement likes_count
  await supabase.rpc('decrement_post_likes', { p_post_id: postId })

  return NextResponse.json({ success: true, liked: false })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params
  const supabase = await getSupabase()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ liked: false })
  }

  const { data: like } = await supabase
    .from('likes')
    .select('*')
    .eq('user_id', user.id)
    .eq('post_id', postId)
    .single()

  return NextResponse.json({ liked: !!like })
}
