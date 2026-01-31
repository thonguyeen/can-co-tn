// ═══════════════════════════════════════════════════════════════
// ACHIEVEMENT SYSTEM
// ═══════════════════════════════════════════════════════════════

export type AchievementCategory =
  | 'engagement'
  | 'social'
  | 'knowledge'
  | 'streak'
  | 'special'

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  category: AchievementCategory
  points: number
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  requirement: {
    type: string
    count?: number
    condition?: string
  }
  secret?: boolean
}

// ═══════════════════════════════════════════════════════════════
// ACHIEVEMENT DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export const ACHIEVEMENTS: Achievement[] = [
  // ENGAGEMENT
  {
    id: 'first_like',
    name: 'First Like',
    description: 'Like bai viet dau tien',
    icon: '❤️',
    category: 'engagement',
    points: 10,
    rarity: 'common',
    requirement: { type: 'likes_given', count: 1 },
  },
  {
    id: 'like_enthusiast',
    name: 'Like Enthusiast',
    description: 'Like 100 bai viet',
    icon: '💕',
    category: 'engagement',
    points: 50,
    rarity: 'uncommon',
    requirement: { type: 'likes_given', count: 100 },
  },
  {
    id: 'first_comment',
    name: 'Voice Heard',
    description: 'Comment bai viet dau tien',
    icon: '💬',
    category: 'engagement',
    points: 15,
    rarity: 'common',
    requirement: { type: 'comments_made', count: 1 },
  },
  {
    id: 'comment_warrior',
    name: 'Comment Warrior',
    description: 'Comment 50 bai viet',
    icon: '⚔️',
    category: 'engagement',
    points: 75,
    rarity: 'uncommon',
    requirement: { type: 'comments_made', count: 50 },
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'La nguoi dau tien comment tren 5 bai',
    icon: '🐦',
    category: 'engagement',
    points: 100,
    rarity: 'rare',
    requirement: { type: 'first_comments', count: 5 },
  },

  // SOCIAL
  {
    id: 'bot_whisperer',
    name: 'Bot Whisperer',
    description: 'Nhan duoc reply tu bot',
    icon: '🤖',
    category: 'social',
    points: 30,
    rarity: 'common',
    requirement: { type: 'bot_replies_received', count: 1 },
  },
  {
    id: 'bot_friend',
    name: 'Bot Friend',
    description: 'Nhan duoc 10 replies tu bots',
    icon: '🤝',
    category: 'social',
    points: 80,
    rarity: 'uncommon',
    requirement: { type: 'bot_replies_received', count: 10 },
  },
  {
    id: 'all_bots_met',
    name: 'Social Butterfly',
    description: 'Tuong tac voi tat ca 9 bots',
    icon: '🦋',
    category: 'social',
    points: 150,
    rarity: 'rare',
    requirement: { type: 'unique_bots_interacted', count: 9 },
  },
  {
    id: 'popular_comment',
    name: 'Popular Comment',
    description: 'Comment duoc 10+ likes',
    icon: '🌟',
    category: 'social',
    points: 60,
    rarity: 'uncommon',
    requirement: { type: 'comment_likes_received', count: 10 },
  },

  // KNOWLEDGE
  {
    id: 'fact_checker',
    name: 'Fact Checker',
    description: 'Report tin sai duoc verified',
    icon: '🔍',
    category: 'knowledge',
    points: 100,
    rarity: 'rare',
    requirement: { type: 'verified_reports', count: 1 },
  },
  {
    id: 'truth_seeker',
    name: 'Truth Seeker',
    description: 'Report 5 tin sai duoc verified',
    icon: '🎯',
    category: 'knowledge',
    points: 200,
    rarity: 'epic',
    requirement: { type: 'verified_reports', count: 5 },
  },
  {
    id: 'oracle',
    name: 'Oracle',
    description: 'Du doan dung 5 lan lien tiep',
    icon: '🔮',
    category: 'knowledge',
    points: 150,
    rarity: 'epic',
    requirement: { type: 'prediction_streak', count: 5 },
  },
  {
    id: 'news_junkie',
    name: 'News Junkie',
    description: 'Doc 100 bai viet',
    icon: '📰',
    category: 'knowledge',
    points: 50,
    rarity: 'uncommon',
    requirement: { type: 'posts_viewed', count: 100 },
  },

  // STREAK
  {
    id: 'streak_3',
    name: 'Getting Started',
    description: 'Streak 3 ngay lien tiep',
    icon: '🔥',
    category: 'streak',
    points: 30,
    rarity: 'common',
    requirement: { type: 'daily_streak', count: 3 },
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Streak 7 ngay lien tiep',
    icon: '🔥🔥',
    category: 'streak',
    points: 70,
    rarity: 'uncommon',
    requirement: { type: 'daily_streak', count: 7 },
  },
  {
    id: 'streak_30',
    name: 'Monthly Master',
    description: 'Streak 30 ngay lien tiep',
    icon: '🔥🔥🔥',
    category: 'streak',
    points: 300,
    rarity: 'epic',
    requirement: { type: 'daily_streak', count: 30 },
  },
  {
    id: 'streak_100',
    name: 'Legendary Streak',
    description: 'Streak 100 ngay lien tiep',
    icon: '💯🔥',
    category: 'streak',
    points: 1000,
    rarity: 'legendary',
    requirement: { type: 'daily_streak', count: 100 },
  },

  // SPECIAL
  {
    id: 'level_5',
    name: 'Rising Star',
    description: 'Dat Level 5',
    icon: '⭐',
    category: 'special',
    points: 50,
    rarity: 'uncommon',
    requirement: { type: 'level', count: 5 },
  },
  {
    id: 'level_10',
    name: 'Mythic Achiever',
    description: 'Dat Level 10',
    icon: '💎',
    category: 'special',
    points: 500,
    rarity: 'legendary',
    requirement: { type: 'level', count: 10 },
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Hoat dong sau 2 gio sang',
    icon: '🦉',
    category: 'special',
    points: 25,
    rarity: 'common',
    requirement: { type: 'active_time', condition: 'after_2am' },
    secret: true,
  },
  {
    id: 'breaking_witness',
    name: 'Breaking Witness',
    description: 'Xem breaking news trong 5 phut dau',
    icon: '📡',
    category: 'special',
    points: 40,
    rarity: 'uncommon',
    requirement: { type: 'breaking_viewed_early', count: 1 },
    secret: true,
  },
  {
    id: 'debate_starter',
    name: 'Debate Starter',
    description: 'Comment gay ra debate giua cac bots',
    icon: '⚡',
    category: 'special',
    points: 100,
    rarity: 'rare',
    requirement: { type: 'debate_triggered', count: 1 },
    secret: true,
  },
]

// ═══════════════════════════════════════════════════════════════
// ACHIEVEMENT OPERATIONS
// ═══════════════════════════════════════════════════════════════

export async function checkAchievement(
  userId: string,
  achievementId: string
): Promise<boolean> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: existing } = await supabase
    .from('user_achievements')
    .select('id')
    .eq('user_id', userId)
    .eq('achievement_id', achievementId)
    .single()

  if (existing) return false

  const achievement = ACHIEVEMENTS.find(a => a.id === achievementId)
  if (!achievement) return false

  await supabase.from('user_achievements').insert({
    user_id: userId,
    achievement_id: achievementId,
    unlocked_at: new Date().toISOString(),
  })

  // Award points (lazy import to avoid circular dep)
  const { awardPoints } = await import('./points')
  await awardPoints(userId, 'achievement_unlock', {
    achievement_id: achievementId,
    achievement_name: achievement.name,
  })

  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'achievement_unlocked',
    title: 'Achievement Unlocked!',
    message: `${achievement.icon} ${achievement.name}: ${achievement.description}`,
    data: { achievement },
  })

  return true
}

export async function checkAllAchievements(userId: string): Promise<string[]> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: stats } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!stats) return []

  const unlocked: string[] = []

  for (const achievement of ACHIEVEMENTS) {
    const { type, count } = achievement.requirement
    let shouldUnlock = false

    switch (type) {
      case 'likes_given':
        shouldUnlock = (stats.likes_given || 0) >= (count || 0)
        break
      case 'comments_made':
        shouldUnlock = (stats.comments_made || 0) >= (count || 0)
        break
      case 'bot_replies_received':
        shouldUnlock = (stats.bot_replies_received || 0) >= (count || 0)
        break
      case 'daily_streak':
        shouldUnlock = (stats.current_streak || 0) >= (count || 0)
        break
      case 'level':
        shouldUnlock = (stats.current_level || 1) >= (count || 0)
        break
      case 'first_comments':
        shouldUnlock = (stats.first_comments || 0) >= (count || 0)
        break
      case 'verified_reports':
        shouldUnlock = (stats.verified_reports || 0) >= (count || 0)
        break
      case 'posts_viewed':
        shouldUnlock = (stats.posts_viewed || 0) >= (count || 0)
        break
      case 'unique_bots_interacted':
        shouldUnlock = (stats.unique_bots_interacted || 0) >= (count || 0)
        break
    }

    if (shouldUnlock) {
      const wasUnlocked = await checkAchievement(userId, achievement.id)
      if (wasUnlocked) {
        unlocked.push(achievement.id)
      }
    }
  }

  return unlocked
}

export async function getUserAchievements(userId: string): Promise<{
  unlocked: Achievement[]
  locked: Achievement[]
  progress: Record<string, number>
}> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: userAchievements } = await supabase
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', userId)

  const unlockedIds = new Set(userAchievements?.map(a => a.achievement_id) || [])

  const unlocked = ACHIEVEMENTS.filter(a => unlockedIds.has(a.id))
  const locked = ACHIEVEMENTS.filter(a => !unlockedIds.has(a.id) && !a.secret)

  const { data: stats } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single()

  const progress: Record<string, number> = {}

  for (const achievement of locked) {
    const { type, count } = achievement.requirement
    if (!count) continue

    let current = 0
    switch (type) {
      case 'likes_given': current = stats?.likes_given || 0; break
      case 'comments_made': current = stats?.comments_made || 0; break
      case 'daily_streak': current = stats?.current_streak || 0; break
      case 'bot_replies_received': current = stats?.bot_replies_received || 0; break
      case 'first_comments': current = stats?.first_comments || 0; break
      case 'posts_viewed': current = stats?.posts_viewed || 0; break
    }

    progress[achievement.id] = Math.min(100, (current / count) * 100)
  }

  return { unlocked, locked, progress }
}

export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id)
}

export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.category === category)
}
