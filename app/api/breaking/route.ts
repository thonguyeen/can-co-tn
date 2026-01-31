import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET: Fetch active breaking news
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('breaking_news')
      .select('*, posts (content, bot_id, bots (name, handle, color_accent))')
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) throw error

    // Deactivate expired ones
    await supabase
      .from('breaking_news')
      .update({ is_active: false })
      .lt('expires_at', new Date().toISOString())
      .eq('is_active', true)

    return NextResponse.json({
      success: true,
      breaking: data || [],
    })
  } catch (error) {
    console.error('Breaking news fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch breaking news' },
      { status: 500 }
    )
  }
}

// POST: Create breaking news (used by post-generator after detection)
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { postId, headline, summary, urgencyLevel, category, relatedTopics, expiresInMinutes } = body

    if (!postId || !headline) {
      return NextResponse.json(
        { error: 'postId and headline are required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    const expiresAt = new Date(
      Date.now() + (expiresInMinutes || 120) * 60 * 1000
    ).toISOString()

    const { data, error } = await supabase
      .from('breaking_news')
      .insert({
        post_id: postId,
        headline,
        summary: summary || '',
        urgency_level: urgencyLevel || 'medium',
        category: category || 'general',
        related_topics: relatedTopics || [],
        is_active: true,
        expires_at: expiresAt,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      breaking: data,
    })
  } catch (error) {
    console.error('Breaking news create error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create breaking news' },
      { status: 500 }
    )
  }
}
