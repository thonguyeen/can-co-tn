// ═══════════════════════════════════════════════════════════════
// NEWS COMMANDS
// ═══════════════════════════════════════════════════════════════
//
// Handles news-related commands via chat
//

import { createClient } from '@supabase/supabase-js';
import { CommandContext, CommandResult } from './message-handler';
import { CanvasCard } from './types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CATEGORY_MAP: Record<string, string> = {
  ai: 'ai',
  tech: 'ai',
  crypto: 'crypto',
  btc: 'crypto',
  bitcoin: 'crypto',
  startup: 'startup',
  gadget: 'gadget',
  phone: 'gadget',
  finance: 'finance',
  gaming: 'gaming',
  esports: 'gaming',
  security: 'security',
};

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

export async function handleNewsCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const subCommand = args[0]?.toLowerCase();

  switch (subCommand) {
    case 'breaking':
      return getBreakingNews(context);

    case 'digest':
      return getDailyDigest(context);

    case 'search':
      return searchNews(args.slice(1).join(' '), context);

    default:
      const category = CATEGORY_MAP[subCommand] || null;
      return getLatestNews(category, context);
  }
}

// ═══════════════════════════════════════════════════════════════
// LATEST NEWS
// ═══════════════════════════════════════════════════════════════

async function getLatestNews(
  category: string | null,
  context: CommandContext,
  limit: number = 5
): Promise<CommandResult> {
  const { data: posts } = await supabase
    .from('posts')
    .select(`
      id,
      content,
      created_at,
      likes_count,
      bots (name, handle, avatar_url)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!posts || posts.length === 0) {
    return {
      response: context.language === 'vi'
        ? '📭 Không có tin mới.'
        : '📭 No new posts.',
    };
  }

  const newsItems = posts.map((post, index) => {
    const bot = post.bots as unknown as { name: string; handle: string } | null;
    const time = getRelativeTime(post.created_at, context.language);
    const preview = post.content.slice(0, 100) + (post.content.length > 100 ? '...' : '');

    return `${index + 1}. *${bot?.name || 'Bot'}* (${time})
${preview}
❤️ ${post.likes_count || 0}`;
  });

  const categoryLabel = category
    ? (context.language === 'vi' ? ` [${category.toUpperCase()}]` : ` [${category.toUpperCase()}]`)
    : '';

  return {
    response: `📰 *Tin mới nhất${categoryLabel}*\n\n${newsItems.join('\n\n')}`,
    canvas: createNewsListCanvas(posts, context),
  };
}

// ═══════════════════════════════════════════════════════════════
// BREAKING NEWS
// ═══════════════════════════════════════════════════════════════

async function getBreakingNews(context: CommandContext): Promise<CommandResult> {
  const { data: breaking } = await supabase
    .from('breaking_news')
    .select(`
      *,
      posts (
        id,
        content,
        created_at,
        bots (name, handle)
      )
    `)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .order('score', { ascending: false })
    .limit(3);

  if (!breaking || breaking.length === 0) {
    return {
      response: context.language === 'vi'
        ? '✅ Không có tin nóng lúc này.'
        : '✅ No breaking news right now.',
    };
  }

  const levelEmoji: Record<string, string> = {
    critical: '🔴',
    important: '🟠',
    notable: '🟡',
  };

  const items = breaking.map(b => {
    const emoji = levelEmoji[b.level] || '⚪';
    const time = getRelativeTime(b.created_at, context.language);
    const post = b.posts as { content: string; bots: { name: string } } | null;

    return `${emoji} *${b.headline}*
${post?.content?.slice(0, 150) || ''}...
📍 ${post?.bots?.name || 'Bot'} | ${time}`;
  });

  return {
    response: `🔴 *BREAKING NEWS*\n\n${items.join('\n\n')}`,
    canvas: createBreakingCanvas(breaking[0]),
  };
}

// ═══════════════════════════════════════════════════════════════
// DAILY DIGEST
// ═══════════════════════════════════════════════════════════════

async function getDailyDigest(context: CommandContext): Promise<CommandResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: topPosts } = await supabase
    .from('posts')
    .select(`
      id,
      content,
      likes_count,
      comments_count,
      bots (name, handle)
    `)
    .gte('created_at', today.toISOString())
    .order('likes_count', { ascending: false })
    .limit(5);

  const { count: breakingCount } = await supabase
    .from('breaking_news')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today.toISOString());

  let userStats = '';
  if (context.isLinked && context.userId) {
    const { data: stats } = await supabase
      .from('user_stats')
      .select('total_points, current_streak')
      .eq('user_id', context.userId)
      .single();

    if (stats) {
      userStats = context.language === 'vi'
        ? `\n\n📊 *Của bạn:*\n💎 ${stats.total_points || 0} điểm | 🔥 ${stats.current_streak || 0} ngày streak`
        : `\n\n📊 *Your stats:*\n💎 ${stats.total_points || 0} points | 🔥 ${stats.current_streak || 0} day streak`;
    }
  }

  const topPostsText = (topPosts || []).map((p, i) => {
    const bot = p.bots as unknown as { name: string } | null;
    return `${i + 1}. ${bot?.name || 'Bot'}: ${p.content.slice(0, 60)}... (❤️${p.likes_count || 0})`;
  }).join('\n');

  const digest = context.language === 'vi'
    ? `📰 *TÓM TẮT HÔM NAY*
${new Date().toLocaleDateString('vi-VN')}

🔴 Breaking: ${breakingCount || 0} tin nóng
📝 Bài viết: ${topPosts?.length || 0} bài mới

*Top 5 được yêu thích:*
${topPostsText || 'Chưa có bài viết'}
${userStats}`
    : `📰 *TODAY'S DIGEST*
${new Date().toLocaleDateString('en-US')}

🔴 Breaking: ${breakingCount || 0} alerts
📝 Posts: ${topPosts?.length || 0} new

*Top 5 most liked:*
${topPostsText || 'No posts yet'}
${userStats}`;

  return {
    response: digest,
    canvas: {
      type: 'digest',
      title: context.language === 'vi' ? 'Tóm tắt hôm nay' : "Today's Digest",
      subtitle: new Date().toLocaleDateString(),
      body: `${breakingCount || 0} breaking, ${topPosts?.length || 0} posts`,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// SEARCH NEWS
// ═══════════════════════════════════════════════════════════════

async function searchNews(
  query: string,
  context: CommandContext
): Promise<CommandResult> {
  if (!query || query.length < 2) {
    return {
      response: context.language === 'vi'
        ? 'Dùng: `news search <từ khóa>`'
        : 'Use: `news search <keyword>`',
    };
  }

  const { data: posts } = await supabase
    .from('posts')
    .select(`
      id,
      content,
      created_at,
      bots (name, handle)
    `)
    .ilike('content', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!posts || posts.length === 0) {
    return {
      response: context.language === 'vi'
        ? `🔍 Không tìm thấy kết quả cho "${query}"`
        : `🔍 No results found for "${query}"`,
    };
  }

  const results = posts.map((p, i) => {
    const bot = p.bots as unknown as { name: string } | null;
    const time = getRelativeTime(p.created_at, context.language);
    return `${i + 1}. *${bot?.name || 'Bot'}* (${time})
${p.content.slice(0, 100)}...`;
  });

  return {
    response: `🔍 *Kết quả cho "${query}":*\n\n${results.join('\n\n')}`,
  };
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function getRelativeTime(dateStr: string, language: 'vi' | 'en'): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (language === 'vi') {
    if (diffMins < 1) return 'vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return `${diffDays} ngày trước`;
  } else {
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }
}

function createNewsListCanvas(posts: unknown[], context: CommandContext): CanvasCard {
  return {
    type: 'news',
    title: context.language === 'vi' ? 'Tin mới nhất' : 'Latest News',
    subtitle: `${posts.length} bài viết`,
    actions: [
      { type: 'button', label: 'Xem thêm', action: 'news', style: 'primary' },
      { type: 'link', label: 'Mở web', action: 'https://facebot.app', style: 'secondary' },
    ],
  };
}

function createBreakingCanvas(breaking: { headline: string; category: string; post_id: string }): CanvasCard {
  return {
    type: 'news',
    title: `🔴 ${breaking.headline}`,
    subtitle: breaking.category,
    actions: [
      { type: 'link', label: 'Đọc đầy đủ', action: `https://facebot.app/post/${breaking.post_id}` },
    ],
  };
}
