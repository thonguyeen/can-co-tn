// ═══════════════════════════════════════════════════════════════
// DAILY DIGEST SCHEDULER
// ═══════════════════════════════════════════════════════════════
//
// Sends personalized daily digest to users at their preferred time
//

import { createClient } from '@supabase/supabase-js';
import { getOpenClawClient } from './client';
import { CanvasCard, OpenClawChannel } from './types';
import { ChannelPreferences } from './channel-manager';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ═══════════════════════════════════════════════════════════════
// MAIN SCHEDULER (Called by cron)
// ═══════════════════════════════════════════════════════════════

export async function sendScheduledDigests(): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const currentHour = new Date().getHours().toString().padStart(2, '0');
  const currentMinute = Math.floor(new Date().getMinutes() / 30) * 30;
  const timeSlot = `${currentHour}:${currentMinute.toString().padStart(2, '0')}`;

  // Get users who want digest at this time
  const { data: users } = await supabase
    .from('user_channels')
    .select('user_id, channel, channel_id, preferences, subscriptions')
    .eq('is_verified', true);

  const eligibleUsers = (users || []).filter(u => {
    const prefs = (u.preferences || {}) as ChannelPreferences;
    return prefs.dailyDigest && prefs.digestTime === timeSlot;
  });

  if (eligibleUsers.length === 0) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const client = getOpenClawClient();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const user of eligibleUsers) {
    try {
      const prefs = (user.preferences || {}) as ChannelPreferences;
      const digest = await generatePersonalizedDigest(
        user.user_id,
        user.subscriptions || ['all'],
        prefs.language || 'vi'
      );

      if (!digest) {
        skipped++;
        continue;
      }

      const result = await client.send({
        channel: user.channel as OpenClawChannel,
        recipient: user.channel_id,
        content: digest.message,
        format: 'canvas',
        canvas: digest.canvas,
      });

      if (result.success) {
        sent++;
      } else {
        failed++;
      }

    } catch (error) {
      failed++;
      console.error(`Digest failed for user ${user.user_id}:`, error);
    }
  }

  // Log
  await supabase.from('push_logs').insert({
    type: 'daily_digest',
    reference_id: timeSlot,
    recipients_count: eligibleUsers.length,
    sent_count: sent,
    failed_count: failed,
    errors: [],
  });

  return { sent, failed, skipped };
}

// ═══════════════════════════════════════════════════════════════
// PERSONALIZED DIGEST GENERATION
// ═══════════════════════════════════════════════════════════════

async function generatePersonalizedDigest(
  userId: string,
  subscriptions: string[],
  language: 'vi' | 'en'
): Promise<{ message: string; canvas: CanvasCard } | null> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get top posts from subscribed categories
  const { data: posts } = await supabase
    .from('posts')
    .select(`
      id,
      content,
      likes_count,
      comments_count,
      created_at,
      bots (name, handle)
    `)
    .gte('created_at', yesterday.toISOString())
    .lt('created_at', today.toISOString())
    .order('likes_count', { ascending: false })
    .limit(10);

  if (!posts || posts.length === 0) {
    return null; // No content to send
  }

  // Get user's stats
  const { data: stats } = await supabase
    .from('user_stats')
    .select('total_points, current_streak, current_level')
    .eq('user_id', userId)
    .single();

  // Get breaking count
  const { count: breakingCount } = await supabase
    .from('breaking_news')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', yesterday.toISOString());

  // Get pending predictions
  const { data: predictions } = await supabase
    .from('predictions')
    .select('id, question')
    .eq('status', 'open')
    .limit(2);

  // Format message
  const topPosts = posts.slice(0, 5).map((p, i) => {
    const bot = p.bots as unknown as { name: string } | null;
    return `${i + 1}. ${bot?.name || 'Bot'}: ${p.content.slice(0, 60)}... (❤️${p.likes_count || 0})`;
  }).join('\n');

  const predictionsText = predictions && predictions.length > 0
    ? `\n\n🎯 *Dự đoán mở:*\n${predictions.map(p => `• ${p.question?.slice(0, 50) || ''}...`).join('\n')}`
    : '';

  const message = language === 'vi'
    ? `☀️ *FACEBOT Daily Digest*
${new Date().toLocaleDateString('vi-VN')}

📊 *Tóm tắt 24h qua:*
• 🔴 ${breakingCount || 0} tin nóng
• 📝 ${posts.length} bài mới

*Top 5 được quan tâm:*
${topPosts}
${predictionsText}

💎 Điểm: ${stats?.total_points || 0} | 🔥 Streak: ${stats?.current_streak || 0} ngày

---
Gõ "news" để xem chi tiết | "help" để xem commands`
    : `☀️ *FACEBOT Daily Digest*
${new Date().toLocaleDateString('en-US')}

📊 *Last 24h summary:*
• 🔴 ${breakingCount || 0} breaking
• 📝 ${posts.length} new posts

*Top 5 trending:*
${topPosts}
${predictionsText}

💎 Points: ${stats?.total_points || 0} | 🔥 Streak: ${stats?.current_streak || 0} days`;

  const canvas: CanvasCard = {
    type: 'digest',
    title: language === 'vi' ? 'Tóm tắt hàng ngày' : 'Daily Digest',
    subtitle: new Date().toLocaleDateString(),
    body: `${breakingCount || 0} breaking, ${posts.length} posts`,
    actions: [
      { type: 'button', label: 'Xem tin', action: 'news', style: 'primary' },
      { type: 'button', label: 'Dự đoán', action: 'predictions', style: 'secondary' },
    ],
    metadata: {
      postsCount: posts.length,
      breakingCount: breakingCount || 0,
    },
  };

  return { message, canvas };
}

// ═══════════════════════════════════════════════════════════════
// MANUAL DIGEST TRIGGER
// ═══════════════════════════════════════════════════════════════

export async function sendDigestToUser(
  userId: string,
  channel: OpenClawChannel,
  channelId: string
): Promise<boolean> {
  const client = getOpenClawClient();

  const { data: prefs } = await supabase
    .from('user_channels')
    .select('preferences')
    .eq('user_id', userId)
    .eq('channel', channel)
    .single();

  const language = (prefs?.preferences as ChannelPreferences)?.language || 'vi';

  const digest = await generatePersonalizedDigest(userId, ['all'], language);

  if (!digest) {
    return false;
  }

  const result = await client.send({
    channel,
    recipient: channelId,
    content: digest.message,
    format: 'canvas',
    canvas: digest.canvas,
  });

  return result.success;
}
