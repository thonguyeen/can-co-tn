// ═══════════════════════════════════════════════════════════════
// LEADERBOARD SYSTEM
// ═══════════════════════════════════════════════════════════════

import { getLevelForPoints } from './points'

export type LeaderboardType =
  | 'all_time'
  | 'weekly'
  | 'streak'
  | 'predictions'

export interface LeaderboardEntry {
  rank: number
  userId: string
  username: string
  avatarUrl?: string
  points: number
  level: number
  levelName: string
  levelIcon: string
  streak?: number
}

// ═══════════════════════════════════════════════════════════════
// LEADERBOARD QUERIES
// ═══════════════════════════════════════════════════════════════

export async function getLeaderboard(
  type: LeaderboardType,
  limit: number = 10
): Promise<LeaderboardEntry[]> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any[] = []

  switch (type) {
    case 'all_time': {
      const { data: allTime } = await supabase
        .from('user_stats')
        .select('user_id, total_points, current_level, current_streak')
        .order('total_points', { ascending: false })
        .limit(limit)
      data = allTime || []
      break
    }

    case 'weekly': {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)

      const { data: weekly } = await supabase
        .from('point_transactions')
        .select('user_id, points')
        .gte('created_at', weekAgo.toISOString())

      const weeklyTotals = new Map<string, number>()
      ;(weekly || []).forEach(t => {
        weeklyTotals.set(t.user_id, (weeklyTotals.get(t.user_id) || 0) + t.points)
      })

      const weeklyUserIds = [...weeklyTotals.keys()]
      if (weeklyUserIds.length === 0) break

      const { data: weeklyUsers } = await supabase
        .from('user_stats')
        .select('user_id, current_level, current_streak')
        .in('user_id', weeklyUserIds)

      data = [...weeklyTotals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([userId, points]) => {
          const user = weeklyUsers?.find(u => u.user_id === userId)
          return {
            user_id: userId,
            total_points: points,
            current_level: user?.current_level || 1,
            current_streak: user?.current_streak || 0,
          }
        })
      break
    }

    case 'streak': {
      const { data: streaks } = await supabase
        .from('user_stats')
        .select('user_id, total_points, current_level, current_streak')
        .order('current_streak', { ascending: false })
        .limit(limit)
      data = streaks || []
      break
    }

    case 'predictions': {
      const { data: predictions } = await supabase
        .from('user_stats')
        .select('user_id, total_points, current_level, predictions_correct')
        .order('predictions_correct', { ascending: false })
        .limit(limit)
      data = predictions || []
      break
    }
  }

  // Fetch profiles for all users
  const userIds = data.map(d => d.user_id)
  let profiles: Record<string, { display_name: string; avatar_url?: string }> = {}

  if (userIds.length > 0) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', userIds)

    if (profileData) {
      profiles = Object.fromEntries(
        profileData.map(p => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }])
      )
    }
  }

  return data.map((entry, index) => {
    const level = getLevelForPoints(entry.total_points || 0)
    const profile = profiles[entry.user_id]
    return {
      rank: index + 1,
      userId: entry.user_id,
      username: profile?.display_name || 'Anonymous',
      avatarUrl: profile?.avatar_url,
      points: entry.total_points || 0,
      level: entry.current_level || 1,
      levelName: level.name,
      levelIcon: level.icon,
      streak: entry.current_streak,
    }
  })
}

export async function getUserRank(userId: string): Promise<{
  allTime: number
  weekly: number
}> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: userStats } = await supabase
    .from('user_stats')
    .select('total_points')
    .eq('user_id', userId)
    .single()

  const userPoints = userStats?.total_points || 0

  const { count: higherCount } = await supabase
    .from('user_stats')
    .select('*', { count: 'exact', head: true })
    .gt('total_points', userPoints)

  return {
    allTime: (higherCount || 0) + 1,
    weekly: Math.max(1, Math.floor(((higherCount || 0) + 1) / 2)),
  }
}
