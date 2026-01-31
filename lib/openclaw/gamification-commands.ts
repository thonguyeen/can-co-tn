// ═══════════════════════════════════════════════════════════════
// GAMIFICATION COMMANDS
// ═══════════════════════════════════════════════════════════════
//
// Handles stats, leaderboard, achievements commands
//

import { createClient } from '@supabase/supabase-js';
import { CommandContext, CommandResult } from './message-handler';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Level configuration
const LEVELS = [
  { level: 1, name: 'Newbie', icon: '🌱', minPoints: 0 },
  { level: 2, name: 'Reader', icon: '📖', minPoints: 100 },
  { level: 3, name: 'Explorer', icon: '🔍', minPoints: 300 },
  { level: 4, name: 'Enthusiast', icon: '⭐', minPoints: 600 },
  { level: 5, name: 'Expert', icon: '🎓', minPoints: 1000 },
  { level: 6, name: 'Master', icon: '🏆', minPoints: 2000 },
  { level: 7, name: 'Legend', icon: '👑', minPoints: 5000 },
  { level: 8, name: 'Mythic', icon: '💎', minPoints: 10000 },
];

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

export async function handleGamificationCommand(
  command: string,
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  if (!context.isLinked) {
    return {
      response: context.language === 'vi'
        ? '🔗 Liên kết tài khoản để xem stats. Gõ "link".'
        : '🔗 Link your account to view stats. Type "link".',
    };
  }

  switch (command) {
    case 'stats':
      return getStats(context);

    case 'leaderboard':
      return getLeaderboardCommand(args, context);

    case 'achievements':
      return getAchievementsCommand(context);

    case 'streak':
      return getStreakCommand(context);

    default:
      return getStats(context);
  }
}

// ═══════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════

async function getStats(context: CommandContext): Promise<CommandResult> {
  // Get user stats
  const { data: stats } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', context.userId)
    .single();

  if (!stats) {
    return {
      response: context.language === 'vi'
        ? '📊 Chưa có dữ liệu. Hãy tương tác với FACEBOT để bắt đầu!'
        : '📊 No data yet. Start interacting with FACEBOT!',
    };
  }

  const points = stats.total_points || 0;
  const streak = stats.current_streak || 0;

  // Calculate level
  const currentLevel = LEVELS.slice().reverse().find(l => points >= l.minPoints) || LEVELS[0];
  const nextLevel = LEVELS.find(l => l.minPoints > points);

  const progress = nextLevel
    ? Math.round(((points - currentLevel.minPoints) / (nextLevel.minPoints - currentLevel.minPoints)) * 100)
    : 100;

  const levelBar = createProgressBar(progress);

  // Get rank
  const { count: higherRank } = await supabase
    .from('user_stats')
    .select('*', { count: 'exact', head: true })
    .gt('total_points', points);

  const rank = (higherRank || 0) + 1;

  // Get achievements count
  const { count: achievementCount } = await supabase
    .from('user_achievements')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', context.userId);

  const message = context.language === 'vi'
    ? `📊 *Stats của bạn*

${currentLevel.icon} *Level ${currentLevel.level}* - ${currentLevel.name}
💎 ${points.toLocaleString()} điểm
${levelBar} ${progress}%
${nextLevel ? `⬆️ Còn ${(nextLevel.minPoints - points).toLocaleString()} điểm → ${nextLevel.icon} ${nextLevel.name}` : '🎉 Max level!'}

🔥 Streak: ${streak} ngày ${streak >= 7 ? '🔥🔥' : ''}
📈 Longest: ${stats.longest_streak || 0} ngày
🏆 Achievements: ${achievementCount || 0}

📊 Xếp hạng: #${rank}`
    : `📊 *Your Stats*

${currentLevel.icon} *Level ${currentLevel.level}* - ${currentLevel.name}
💎 ${points.toLocaleString()} points
${levelBar} ${progress}%
${nextLevel ? `⬆️ ${(nextLevel.minPoints - points).toLocaleString()} points to ${nextLevel.icon} ${nextLevel.name}` : '🎉 Max level!'}

🔥 Streak: ${streak} days ${streak >= 7 ? '🔥🔥' : ''}
📈 Longest: ${stats.longest_streak || 0} days
🏆 Achievements: ${achievementCount || 0}

📊 Rank: #${rank}`;

  return { response: message };
}

// ═══════════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════════

async function getLeaderboardCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const type = args[0]?.toLowerCase() || 'all';

  let query = supabase
    .from('user_stats')
    .select(`
      user_id,
      total_points,
      current_streak,
      profiles (display_name)
    `)
    .order('total_points', { ascending: false })
    .limit(10);

  if (type === 'weekly') {
    query = query.order('weekly_points', { ascending: false });
  } else if (type === 'streak') {
    query = query.order('current_streak', { ascending: false });
  }

  const { data: entries } = await query;

  if (!entries || entries.length === 0) {
    return {
      response: context.language === 'vi'
        ? '📭 Chưa có dữ liệu xếp hạng.'
        : '📭 No ranking data yet.',
    };
  }

  const medals = ['🥇', '🥈', '🥉'];

  const list = entries.map((e, i) => {
    const medal = medals[i] || `${i + 1}.`;
    const profile = e.profiles as unknown as { display_name: string } | null;
    const name = profile?.display_name || 'Anonymous';
    const points = e.total_points || 0;
    const level = LEVELS.slice().reverse().find(l => points >= l.minPoints) || LEVELS[0];
    const highlight = e.user_id === context.userId ? '👈' : '';

    return `${medal} ${level.icon} ${name} - ${points.toLocaleString()} ${highlight}`;
  }).join('\n');

  const typeLabels: Record<string, string> = {
    all: context.language === 'vi' ? 'Tổng' : 'All Time',
    weekly: context.language === 'vi' ? 'Tuần này' : 'This Week',
    streak: 'Streak',
  };

  return {
    response: `🏆 *Bảng xếp hạng - ${typeLabels[type] || 'Tổng'}*\n\n${list}\n\nXem khác: \`leaderboard weekly\`, \`leaderboard streak\``,
  };
}

// ═══════════════════════════════════════════════════════════════
// ACHIEVEMENTS
// ═══════════════════════════════════════════════════════════════

async function getAchievementsCommand(context: CommandContext): Promise<CommandResult> {
  const { data: userAchievements } = await supabase
    .from('user_achievements')
    .select('achievement_id, unlocked_at')
    .eq('user_id', context.userId);

  const unlockedIds = new Set((userAchievements || []).map(a => a.achievement_id));

  // Sample achievements list
  const allAchievements = [
    { id: 'first_login', name: 'First Steps', icon: '🚀', description: 'Login for the first time' },
    { id: 'first_comment', name: 'Speaker', icon: '💬', description: 'Write your first comment' },
    { id: 'streak_7', name: 'Week Warrior', icon: '🔥', description: '7-day streak' },
    { id: 'streak_30', name: 'Monthly Master', icon: '🌟', description: '30-day streak' },
    { id: 'points_100', name: 'Getting Started', icon: '💯', description: 'Earn 100 points' },
    { id: 'points_1000', name: 'Engaged', icon: '⭐', description: 'Earn 1000 points' },
    { id: 'prediction_win', name: 'Fortune Teller', icon: '🎯', description: 'Win a prediction' },
    { id: 'prediction_5', name: 'Predictor', icon: '🔮', description: 'Make 5 predictions' },
  ];

  const unlocked = allAchievements.filter(a => unlockedIds.has(a.id));
  const locked = allAchievements.filter(a => !unlockedIds.has(a.id));

  const unlockedList = unlocked.slice(0, 8).map(a =>
    `${a.icon} ${a.name}`
  ).join(' | ') || 'Chưa có';

  const lockedList = locked.slice(0, 3).map(a =>
    `🔒 ${a.name} - ${a.description}`
  ).join('\n');

  const message = context.language === 'vi'
    ? `🏆 *Achievements* (${unlocked.length}/${allAchievements.length})

*Đã mở khóa:*
${unlockedList}

*Chưa mở:*
${lockedList}

💡 Tương tác nhiều hơn để mở achievements mới!`
    : `🏆 *Achievements* (${unlocked.length}/${allAchievements.length})

*Unlocked:*
${unlockedList}

*Locked:*
${lockedList}

💡 Engage more to unlock new achievements!`;

  return { response: message };
}

// ═══════════════════════════════════════════════════════════════
// STREAK
// ═══════════════════════════════════════════════════════════════

async function getStreakCommand(context: CommandContext): Promise<CommandResult> {
  const { data: stats } = await supabase
    .from('user_stats')
    .select('current_streak, longest_streak, last_active_date')
    .eq('user_id', context.userId)
    .single();

  const currentStreak = stats?.current_streak || 0;
  const longestStreak = stats?.longest_streak || 0;

  const fireEmoji = currentStreak >= 30 ? '🔥🔥🔥' :
                    currentStreak >= 7 ? '🔥🔥' :
                    currentStreak >= 3 ? '🔥' : '';

  const milestones = [3, 7, 14, 30, 60, 100];
  const nextMilestone = milestones.find(m => m > currentStreak) || currentStreak + 10;
  const daysToMilestone = nextMilestone - currentStreak;

  // Check if active today
  const today = new Date().toISOString().split('T')[0];
  const lastActive = stats?.last_active_date?.split('T')[0];
  const isActiveToday = lastActive === today;

  const message = context.language === 'vi'
    ? `🔥 *Streak của bạn*

${fireEmoji} Hiện tại: *${currentStreak} ngày*
📈 Kỷ lục: ${longestStreak} ngày
📅 Hôm nay: ${isActiveToday ? '✅ Đã check-in' : '⏳ Chưa check-in'}

🎯 Milestone tiếp: ${nextMilestone} ngày (còn ${daysToMilestone} ngày)

Cố lên! Đừng để mất streak! 💪`
    : `🔥 *Your Streak*

${fireEmoji} Current: *${currentStreak} days*
📈 Best: ${longestStreak} days
📅 Today: ${isActiveToday ? '✅ Checked in' : '⏳ Not yet'}

🎯 Next milestone: ${nextMilestone} days (${daysToMilestone} to go)

Keep going! Don't break it! 💪`;

  return { response: message };
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function createProgressBar(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}
