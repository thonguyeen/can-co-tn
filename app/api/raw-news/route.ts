import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = parseInt(searchParams.get('offset') || '0')
  const processed = searchParams.get('processed')

  const supabase = getSupabaseAdmin()

  let query = supabase
    .from('raw_news')
    .select(
      `
      *,
      sources (name, credibility_score)
    `
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (processed === 'true') {
    query = query.eq('is_processed', true)
  } else if (processed === 'false') {
    query = query.eq('is_processed', false)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ news: data })
}
