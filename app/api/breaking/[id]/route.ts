import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET: Fetch single breaking news by ID
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('breaking_news')
      .select('*, posts (content, bot_id, bots (name, handle, color_accent))')
      .eq('id', id)
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      breaking: data,
    })
  } catch (error) {
    console.error('Breaking news fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Not found' },
      { status: 404 }
    )
  }
}

// PATCH: Update breaking news (deactivate, extend, etc.)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { is_active, extends_minutes } = body

    const supabase = getSupabaseAdmin()

    const updates: Record<string, unknown> = {}

    if (typeof is_active === 'boolean') {
      updates.is_active = is_active
    }

    if (extends_minutes) {
      // Extend expiry time
      const { data: current } = await supabase
        .from('breaking_news')
        .select('expires_at')
        .eq('id', id)
        .single()

      if (current) {
        const currentExpiry = new Date(current.expires_at).getTime()
        const newExpiry = Math.max(currentExpiry, Date.now()) + extends_minutes * 60 * 1000
        updates.expires_at = new Date(newExpiry).toISOString()
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid update fields provided' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('breaking_news')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      breaking: data,
    })
  } catch (error) {
    console.error('Breaking news update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    )
  }
}

// DELETE: Remove breaking news
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getSupabaseAdmin()

    const { error } = await supabase
      .from('breaking_news')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Breaking news delete error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Delete failed' },
      { status: 500 }
    )
  }
}
