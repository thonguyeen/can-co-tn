// ═══════════════════════════════════════════════════════════════
// BREAKING NEWS PUSH SERVICE
// ═══════════════════════════════════════════════════════════════
//
// Pushes breaking news to subscribed users via OpenClaw
//

import { getOpenClawClient } from './client';
import { getSubscribedUsers } from './channel-manager';
import { CanvasCard } from './types';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const LEVEL_CONFIG = {
  critical: { emoji: '🔴', label: 'CRITICAL', shouldPush: true },
  important: { emoji: '🟠', label: 'IMPORTANT', shouldPush: true },
  notable: { emoji: '🟡', label: 'NOTABLE', shouldPush: false },
  normal: { emoji: '⚪', label: 'NEWS', shouldPush: false },
};

// ═══════════════════════════════════════════════════════════════
// MAIN PUSH FUNCTION
// ═══════════════════════════════════════════════════════════════

export async function pushBreakingNews(
  breakingId: string
): Promise<{ sent: number; failed: number }> {
  const client = getOpenClawClient();

  // Get breaking news details
  const { data: breaking } = await supabase
    .from('breaking_news')
    .select(`
      *,
      posts (
        id,
        content,
        bots (name, handle, avatar_url)
      )
    `)
    .eq('id', breakingId)
    .single();

  if (!breaking) {
    return { sent: 0, failed: 0 };
  }

  const config = LEVEL_CONFIG[breaking.level as keyof typeof LEVEL_CONFIG] || LEVEL_CONFIG.normal;

  // Get subscribed users
  const subscribers = await getSubscribedUsers(breaking.category || 'all', 'breakingNews');

  if (subscribers.length === 0) {
    return { sent: 0, failed: 0 };
  }

  // Build message
  const message = formatBreakingMessage(breaking, config);
  const canvas = createBreakingCanvas(breaking, config);

  // Broadcast
  const result = await client.broadcast(
    subscribers.map(s => ({ channel: s.channel, recipient: s.channelId })),
    message,
    canvas
  );

  // Log push
  await supabase.from('push_logs').insert({
    type: 'breaking_news',
    reference_id: breakingId,
    recipients_count: subscribers.length,
    sent_count: result.sent,
    failed_count: result.failed,
    errors: result.errors,
  });

  return { sent: result.sent, failed: result.failed };
}

function formatBreakingMessage(
  breaking: {
    headline: string;
    post_id: string;
    posts: { content: string; bots: { name: string; handle: string } } | null;
  },
  config: typeof LEVEL_CONFIG[keyof typeof LEVEL_CONFIG]
): string {
  const bot = breaking.posts?.bots;
  const content = breaking.posts?.content || '';

  return `${config.emoji} *${config.label}: ${breaking.headline}*

${content.slice(0, 300)}${content.length > 300 ? '...' : ''}

📍 via @${bot?.handle || 'facebot'}
🔗 https://facebot.app/post/${breaking.post_id}

---
Tắt thông báo: \`settings breaking off\``;
}

function createBreakingCanvas(
  breaking: {
    headline: string;
    category?: string;
    level: string;
    post_id: string;
    posts: { content: string; bots: { avatar_url?: string } } | null;
  },
  config: typeof LEVEL_CONFIG[keyof typeof LEVEL_CONFIG]
): CanvasCard {
  return {
    type: 'news',
    title: `${config.emoji} ${config.label}`,
    subtitle: breaking.headline,
    imageUrl: breaking.posts?.bots?.avatar_url,
    body: breaking.posts?.content?.slice(0, 200),
    actions: [
      {
        type: 'link',
        label: 'Đọc đầy đủ',
        action: `https://facebot.app/post/${breaking.post_id}`,
        style: 'primary',
      },
      {
        type: 'button',
        label: 'Tắt thông báo',
        action: 'settings breaking off',
        style: 'secondary',
      },
    ],
    metadata: {
      level: breaking.level,
      category: breaking.category,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// INTEGRATION WITH BREAKING DETECTOR
// ═══════════════════════════════════════════════════════════════

export async function onBreakingNewsCreated(breakingId: string): Promise<void> {
  const { data } = await supabase
    .from('breaking_news')
    .select('level, should_notify')
    .eq('id', breakingId)
    .single();

  if (!data) return;

  const config = LEVEL_CONFIG[data.level as keyof typeof LEVEL_CONFIG] || LEVEL_CONFIG.normal;

  if (config.shouldPush && data.should_notify !== false) {
    await pushBreakingNews(breakingId);
  }
}
