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
  const { id: botId } = await params
  const supabase = await getSupabase()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if already following
  const { data: existingFollow } = await supabase
    .from('follows')
    .select('*')
    .eq('user_id', user.id)
    .eq('bot_id', botId)
    .single()

  if (existingFollow) {
    return NextResponse.json({ error: 'Already following' }, { status: 400 })
  }

  // Insert follow
  const { error: insertError } = await supabase
    .from('follows')
    .insert({ user_id: user.id, bot_id: botId })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Increment followers_count
  await supabase.rpc('increment_bot_followers', { p_bot_id: botId })

  return NextResponse.json({ success: true, following: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: botId } = await params
  const supabase = await getSupabase()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Delete follow
  const { error: deleteError } = await supabase
    .from('follows')
    .delete()
    .eq('user_id', user.id)
    .eq('bot_id', botId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  // Decrement followers_count
  await supabase.rpc('decrement_bot_followers', { p_bot_id: botId })

  return NextResponse.json({ success: true, following: false })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: botId } = await params
  const supabase = await getSupabase()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ following: false })
  }

  const { data: follow } = await supabase
    .from('follows')
    .select('*')
    .eq('user_id', user.id)
    .eq('bot_id', botId)
    .single()

  return NextResponse.json({ following: !!follow })
}
