// ═══════════════════════════════════════════════════════════════
// STREAK SYSTEM
// ═══════════════════════════════════════════════════════════════

import { awardPoints, POINT_VALUES } from './points'
import { checkAchievement } from './achievements'

export interface StreakInfo {
  currentStreak: number
  longestStreak: number
  lastActiveDate: string | null
  isActiveToday: boolean
  streakBroken: boolean
  nextMilestone: number
}

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100]

// ═══════════════════════════════════════════════════════════════
// STREAK OPERATIONS
// ═══════════════════════════════════════════════════════════════

export async function recordDailyActivity(userId: string): Promise<StreakInfo> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date().toISOString().split('T')[0]

  const { data: stats } = await supabase
    .from('user_stats')
    .select('current_streak, longest_streak, last_active_date')
    .eq('user_id', userId)
    .single()

  const currentStreak = stats?.current_streak || 0
  const longestStreak = stats?.longest_streak || 0
  const lastActiveDate = stats?.last_active_date

  if (lastActiveDate === today) {
    return {
      currentStreak,
      longestStreak,
      lastActiveDate,
      isActiveToday: true,
      streakBroken: false,
      nextMilestone: getNextMilestone(currentStreak),
    }
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  let newStreak: number
  let streakBroken = false

  if (lastActiveDate === yesterdayStr) {
    newStreak = currentStreak + 1
  } else if (!lastActiveDate) {
    newStreak = 1
  } else {
    newStreak = 1
    streakBroken = currentStreak > 0
  }

  const newLongest = Math.max(longestStreak, newStreak)

  await supabase
    .from('user_stats')
    .upsert({
      user_id: userId,
      current_streak: newStreak,
      longest_streak: newLongest,
      last_active_date: today,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  await awardPoints(userId, 'daily_login')

  if (newStreak > 1) {
    const streakBonus = POINT_VALUES.streak_bonus * newStreak
    await supabase.from('point_transactions').insert({
      user_id: userId,
      action: 'streak_bonus',
      points: streakBonus,
      metadata: { streak_days: newStreak },
    })
  }

  const streakAchievements = ['streak_3', 'streak_7', 'streak_30', 'streak_100']
  for (const achievementId of streakAchievements) {
    await checkAchievement(userId, achievementId)
  }

  if (STREAK_MILESTONES.includes(newStreak)) {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'streak_milestone',
      title: `Streak ${newStreak} ngay!`,
      message: `Tuyet voi! Ban da duy tri streak ${newStreak} ngay lien tiep.`,
      data: { streak: newStreak },
    })
  }

  return {
    currentStreak: newStreak,
    longestStreak: newLongest,
    lastActiveDate: today,
    isActiveToday: true,
    streakBroken,
    nextMilestone: getNextMilestone(newStreak),
  }
}

function getNextMilestone(currentStreak: number): number {
  for (const milestone of STREAK_MILESTONES) {
    if (milestone > currentStreak) {
      return milestone
    }
  }
  return currentStreak + 10
}

export async function getStreakInfo(userId: string): Promise<StreakInfo> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date().toISOString().split('T')[0]

  const { data: stats } = await supabase
    .from('user_stats')
    .select('current_streak, longest_streak, last_active_date')
    .eq('user_id', userId)
    .single()

  if (!stats) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      isActiveToday: false,
      streakBroken: false,
      nextMilestone: 3,
    }
  }

  const isActiveToday = stats.last_active_date === today

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  const streakBroken = !isActiveToday &&
    stats.last_active_date !== yesterdayStr &&
    stats.current_streak > 0

  return {
    currentStreak: streakBroken ? 0 : stats.current_streak,
    longestStreak: stats.longest_streak,
    lastActiveDate: stats.last_active_date,
    isActiveToday,
    streakBroken,
    nextMilestone: getNextMilestone(stats.current_streak),
  }
}
