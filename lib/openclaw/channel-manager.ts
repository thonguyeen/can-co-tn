// ═══════════════════════════════════════════════════════════════
// USER CHANNEL MANAGER
// ═══════════════════════════════════════════════════════════════
//
// Links FACEBOT users to their messaging channels
//

import { createClient } from '@supabase/supabase-js';
import { getOpenClawClient } from './client';
import { OpenClawChannel } from './types';
import { generateVerificationCode } from './security';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface UserChannel {
  id: string;
  userId: string;
  channel: OpenClawChannel;
  channelId: string;
  channelName?: string;
  isVerified: boolean;
  isPrimary: boolean;
  subscriptions: string[];
  preferences: ChannelPreferences;
  linkedAt: string;
  lastActiveAt: string;
}

export interface ChannelPreferences {
  breakingNews: boolean;
  dailyDigest: boolean;
  digestTime: string;
  achievements: boolean;
  predictions: boolean;
  botReplies: boolean;
  language: 'vi' | 'en';
}

const DEFAULT_PREFERENCES: ChannelPreferences = {
  breakingNews: true,
  dailyDigest: true,
  digestTime: '07:00',
  achievements: true,
  predictions: true,
  botReplies: true,
  language: 'vi',
};

// ═══════════════════════════════════════════════════════════════
// LINKING OPERATIONS
// ═══════════════════════════════════════════════════════════════

export async function initiateChannelLink(
  userId: string,
  channel: OpenClawChannel
): Promise<{ code: string; expiresAt: string }> {
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

  // Store pending link
  await supabase.from('channel_link_requests').insert({
    user_id: userId,
    channel,
    verification_code: code,
    expires_at: expiresAt,
    status: 'pending',
  });

  return { code, expiresAt };
}

export async function verifyChannelLink(
  channel: OpenClawChannel,
  channelId: string,
  code: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  // Find pending request
  const { data: request } = await supabase
    .from('channel_link_requests')
    .select('*')
    .eq('channel', channel)
    .eq('verification_code', code)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!request) {
    return { success: false, error: 'Invalid or expired code' };
  }

  // Check if channel already linked to another user
  const { data: existing } = await supabase
    .from('user_channels')
    .select('user_id')
    .eq('channel', channel)
    .eq('channel_id', channelId)
    .single();

  if (existing && existing.user_id !== request.user_id) {
    return { success: false, error: 'Channel already linked to another account' };
  }

  // Check if this is user's first channel
  const { count } = await supabase
    .from('user_channels')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', request.user_id);

  const isPrimary = (count || 0) === 0;

  // Create channel link
  const { error: insertError } = await supabase.from('user_channels').upsert({
    user_id: request.user_id,
    channel,
    channel_id: channelId,
    is_verified: true,
    is_primary: isPrimary,
    subscriptions: ['all'],
    preferences: DEFAULT_PREFERENCES,
  }, {
    onConflict: 'channel,channel_id',
  });

  if (insertError) {
    console.error('Channel link error:', insertError);
    return { success: false, error: 'Failed to link channel' };
  }

  // Update request status
  await supabase
    .from('channel_link_requests')
    .update({ status: 'verified', channel_id: channelId })
    .eq('id', request.id);

  // Send confirmation
  const client = getOpenClawClient();
  await client.send({
    channel,
    recipient: channelId,
    content: `✅ Đã liên kết thành công với FACEBOT!\n\nGõ "help" để xem các lệnh có sẵn.`,
  });

  return { success: true, userId: request.user_id };
}

export async function unlinkChannel(
  userId: string,
  channel: OpenClawChannel
): Promise<void> {
  await supabase
    .from('user_channels')
    .delete()
    .eq('user_id', userId)
    .eq('channel', channel);
}

// ═══════════════════════════════════════════════════════════════
// QUERY OPERATIONS
// ═══════════════════════════════════════════════════════════════

export async function getUserByChannelId(
  channel: OpenClawChannel,
  channelId: string
): Promise<{ userId: string; preferences: ChannelPreferences } | null> {
  const { data } = await supabase
    .from('user_channels')
    .select('user_id, preferences')
    .eq('channel', channel)
    .eq('channel_id', channelId)
    .eq('is_verified', true)
    .single();

  if (!data) return null;

  // Update last active (non-blocking)
  supabase
    .from('user_channels')
    .update({ last_active_at: new Date().toISOString() })
    .eq('channel', channel)
    .eq('channel_id', channelId)
    .then(() => {});

  return {
    userId: data.user_id,
    preferences: data.preferences || DEFAULT_PREFERENCES,
  };
}

export async function getUserChannels(userId: string): Promise<UserChannel[]> {
  const { data } = await supabase
    .from('user_channels')
    .select('*')
    .eq('user_id', userId)
    .eq('is_verified', true);

  return (data || []).map(d => ({
    id: d.id,
    userId: d.user_id,
    channel: d.channel,
    channelId: d.channel_id,
    channelName: d.channel_name,
    isVerified: d.is_verified,
    isPrimary: d.is_primary,
    subscriptions: d.subscriptions || ['all'],
    preferences: d.preferences || DEFAULT_PREFERENCES,
    linkedAt: d.created_at,
    lastActiveAt: d.last_active_at,
  }));
}

export async function getSubscribedUsers(
  category: string,
  notificationType: keyof ChannelPreferences
): Promise<{ channel: OpenClawChannel; channelId: string; userId: string }[]> {
  const { data } = await supabase
    .from('user_channels')
    .select('channel, channel_id, user_id, subscriptions, preferences')
    .eq('is_verified', true);

  return (data || [])
    .filter(d => {
      const subs = d.subscriptions || ['all'];
      const prefs = d.preferences || DEFAULT_PREFERENCES;
      const isSubscribed = subs.includes('all') || subs.includes(category);
      const prefEnabled = prefs[notificationType];
      return isSubscribed && prefEnabled;
    })
    .map(d => ({
      channel: d.channel as OpenClawChannel,
      channelId: d.channel_id,
      userId: d.user_id,
    }));
}

// ═══════════════════════════════════════════════════════════════
// PREFERENCE OPERATIONS
// ═══════════════════════════════════════════════════════════════

export async function updateChannelPreferences(
  userId: string,
  channel: OpenClawChannel,
  preferences: Partial<ChannelPreferences>
): Promise<void> {
  const { data: current } = await supabase
    .from('user_channels')
    .select('preferences')
    .eq('user_id', userId)
    .eq('channel', channel)
    .single();

  const updatedPreferences = {
    ...DEFAULT_PREFERENCES,
    ...current?.preferences,
    ...preferences,
  };

  await supabase
    .from('user_channels')
    .update({ preferences: updatedPreferences })
    .eq('user_id', userId)
    .eq('channel', channel);
}

export async function updateSubscriptions(
  userId: string,
  channel: OpenClawChannel,
  subscriptions: string[]
): Promise<void> {
  await supabase
    .from('user_channels')
    .update({ subscriptions })
    .eq('user_id', userId)
    .eq('channel', channel);
}

export async function setPrimaryChannel(
  userId: string,
  channel: OpenClawChannel
): Promise<void> {
  // Unset all as primary
  await supabase
    .from('user_channels')
    .update({ is_primary: false })
    .eq('user_id', userId);

  // Set new primary
  await supabase
    .from('user_channels')
    .update({ is_primary: true })
    .eq('user_id', userId)
    .eq('channel', channel);
}

export { DEFAULT_PREFERENCES };
