import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST() {
  try {
    // Map of bot handles to their avatar URLs
    const avatarMap: Record<string, string> = {
      'minh_ai': '/avatars/minh_ai.svg',
      'hung_crypto': '/avatars/hung_crypto.svg',
      'mai_finance': '/avatars/mai_finance.svg',
      'lan_startup': '/avatars/lan_startup.svg',
      'duc_security': '/avatars/duc_security.svg',
      'nam_gadget': '/avatars/nam_gadget.svg',
      'tuan_esports': '/avatars/tuan_esports.svg',
      'linh_lifestyle': '/avatars/linh_lifestyle.svg',
      'an_politics': '/avatars/an_politics.svg',
    };

    // Keyword-based avatar assignment for all bots
    const keywordAvatars: Record<string, string> = {
      'tech': '/avatars/bot_tech.svg',
      'ai': '/avatars/minh_ai.svg',
      'crypto': '/avatars/bot_crypto.svg',
      'bitcoin': '/avatars/bot_crypto.svg',
      'finance': '/avatars/bot_finance.svg',
      'money': '/avatars/bot_finance.svg',
      'startup': '/avatars/bot_startup.svg',
      'business': '/avatars/bot_startup.svg',
      'security': '/avatars/bot_security.svg',
      'gaming': '/avatars/bot_gaming.svg',
      'game': '/avatars/bot_gaming.svg',
      'esport': '/avatars/bot_gaming.svg',
      'lifestyle': '/avatars/bot_lifestyle.svg',
      'life': '/avatars/bot_lifestyle.svg',
      'news': '/avatars/bot_news.svg',
      'politics': '/avatars/bot_politics.svg',
      'political': '/avatars/an_politics.svg',
    };

    const results: string[] = [];

    // Update specific bots by handle
    for (const [handle, avatarUrl] of Object.entries(avatarMap)) {
      const { error } = await supabase
        .from('bots')
        .update({ avatar_url: avatarUrl })
        .eq('handle', handle);

      if (error) {
        results.push(`Failed: ${handle} - ${error.message}`);
      } else {
        results.push(`Updated: ${handle} -> ${avatarUrl}`);
      }
    }

    // Get all bots and assign avatars based on keywords
    const { data: allBots } = await supabase
      .from('bots')
      .select('id, handle, name, avatar_url');

    if (allBots) {
      for (const bot of allBots) {
        // Skip if already has a working avatar
        if (bot.avatar_url && bot.avatar_url.includes('.svg')) continue;

        const handleLower = (bot.handle || '').toLowerCase();
        const nameLower = (bot.name || '').toLowerCase();

        let matchedAvatar = '/avatars/bot_tech.svg'; // default

        for (const [keyword, avatar] of Object.entries(keywordAvatars)) {
          if (handleLower.includes(keyword) || nameLower.includes(keyword)) {
            matchedAvatar = avatar;
            break;
          }
        }

        const { error } = await supabase
          .from('bots')
          .update({ avatar_url: matchedAvatar })
          .eq('id', bot.id);

        if (!error) {
          results.push(`Auto-assigned: ${bot.handle} -> ${matchedAvatar}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      totalUpdated: results.filter(r => r.startsWith('Updated')).length,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
