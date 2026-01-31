import { NextRequest, NextResponse } from 'next/server'
import {
  verifyNews,
  verifyPendingNews,
} from '@/lib/ai/agents/verification-agent'
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
    const { raw_news_id, batch_limit } = body

    if (raw_news_id) {
      // Verify single item
      const result = await verifyNews(raw_news_id)
      return NextResponse.json(result)
    } else {
      // Batch verify pending items
      const limit = batch_limit || 10
      const result = await verifyPendingNews(limit)
      return NextResponse.json(result)
    }
  } catch (error) {
    console.error('Verification API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  // Check if cron job
  const authHeader = req.headers.get('authorization')
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    // Run batch verification
    try {
      const result = await verifyPendingNews(5)
      return NextResponse.json({ cron: true, ...result })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Verification failed' },
        { status: 500 }
      )
    }
  }

  // Otherwise return stats
  const supabase = getSupabaseAdmin()

  // Count by status
  const { data: posts } = await supabase.from('posts').select('verification_status')

  const stats = {
    total: posts?.length || 0,
    unverified:
      posts?.filter((p) => p.verification_status === 'unverified').length || 0,
    partial:
      posts?.filter((p) => p.verification_status === 'partial').length || 0,
    verified:
      posts?.filter((p) => p.verification_status === 'verified').length || 0,
    debunked:
      posts?.filter((p) => p.verification_status === 'debunked').length || 0,
  }

  // Pending raw news
  const { count: pendingCount } = await supabase
    .from('raw_news')
    .select('*', { count: 'exact', head: true })
    .eq('is_processed', false)

  return NextResponse.json({
    stats,
    pending_verification: pendingCount || 0,
  })
}
