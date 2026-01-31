import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserRank } from '@/lib/gamification/leaderboard'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getSupabaseAdmin()

    const { data: stats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', id)
      .single()

    if (!stats) {
      return NextResponse.json({
        totalPoints: 0,
        currentLevel: 1,
        currentStreak: 0,
        longestStreak: 0,
        likesGiven: 0,
        commentsMade: 0,
        predictionsCorrect: 0,
        rank: 0,
      })
    }

    const rank = await getUserRank(id)

    return NextResponse.json({
      totalPoints: stats.total_points || 0,
      currentLevel: stats.current_level || 1,
      currentStreak: stats.current_streak || 0,
      longestStreak: stats.longest_streak || 0,
      likesGiven: stats.likes_given || 0,
      commentsMade: stats.comments_made || 0,
      predictionsCorrect: stats.predictions_correct || 0,
      rank: rank.allTime,
    })
  } catch (error) {
    console.error('User stats error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
