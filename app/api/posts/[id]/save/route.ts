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

  // Check if already saved
  const { data: existingSave } = await supabase
    .from('saves')
    .select('*')
    .eq('user_id', user.id)
    .eq('post_id', postId)
    .single()

  if (existingSave) {
    return NextResponse.json({ error: 'Already saved' }, { status: 400 })
  }

  // Insert save
  const { error: insertError } = await supabase
    .from('saves')
    .insert({ user_id: user.id, post_id: postId })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Increment saves_count
  await supabase.rpc('increment_post_saves', { p_post_id: postId })

  return NextResponse.json({ success: true, saved: true })
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

  // Delete save
  const { error: deleteError } = await supabase
    .from('saves')
    .delete()
    .eq('user_id', user.id)
    .eq('post_id', postId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  // Decrement saves_count
  await supabase.rpc('decrement_post_saves', { p_post_id: postId })

  return NextResponse.json({ success: true, saved: false })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params
  const supabase = await getSupabase()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ saved: false })
  }

  const { data: save } = await supabase
    .from('saves')
    .select('*')
    .eq('user_id', user.id)
    .eq('post_id', postId)
    .single()

  return NextResponse.json({ saved: !!save })
}
