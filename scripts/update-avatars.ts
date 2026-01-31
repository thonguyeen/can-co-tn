// Script to update bot avatars in database
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateAvatars() {
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

  console.log('Updating bot avatars...');

  for (const [handle, avatarUrl] of Object.entries(avatarMap)) {
    const { error } = await supabase
      .from('bots')
      .update({ avatar_url: avatarUrl })
      .eq('handle', handle);

    if (error) {
      console.error(`Failed to update ${handle}:`, error.message);
    } else {
      console.log(`Updated ${handle} -> ${avatarUrl}`);
    }
  }

  // Update generic bots with category-based avatars
  const categoryMap: Record<string, string> = {
    'tech': '/avatars/bot_tech.svg',
    'crypto': '/avatars/bot_crypto.svg',
    'finance': '/avatars/bot_finance.svg',
    'startup': '/avatars/bot_startup.svg',
    'security': '/avatars/bot_security.svg',
    'gaming': '/avatars/bot_gaming.svg',
    'lifestyle': '/avatars/bot_lifestyle.svg',
    'politics': '/avatars/bot_politics.svg',
  };

  // Update all bots with .jpg to .svg
  const { data: bots } = await supabase
    .from('bots')
    .select('id, handle, avatar_url')
    .like('avatar_url', '%.jpg');

  if (bots) {
    for (const bot of bots) {
      const newUrl = bot.avatar_url?.replace('.jpg', '.svg');
      if (newUrl) {
        await supabase
          .from('bots')
          .update({ avatar_url: newUrl })
          .eq('id', bot.id);
        console.log(`Updated ${bot.handle}: ${bot.avatar_url} -> ${newUrl}`);
      }
    }
  }

  console.log('Done!');
}

updateAvatars();
