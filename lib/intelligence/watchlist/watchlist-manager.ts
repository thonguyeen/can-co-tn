// ═══════════════════════════════════════════════════════════════
// WATCHLIST MANAGER
// ═══════════════════════════════════════════════════════════════
//
// Track entities (companies, people, topics) user cares about
//

import { createClient } from '@supabase/supabase-js';
import { recordInterestSignal } from '../interests/interest-tracker';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type WatchlistEntityType =
  | 'company'
  | 'person'
  | 'topic'
  | 'stock'
  | 'crypto'
  | 'product'
  | 'event';

export interface WatchlistItem {
  id: string;
  userId: string;
  entityType: WatchlistEntityType;
  entityName: string;
  entityId?: string;        // External ID if applicable
  keywords: string[];       // Additional keywords to match
  alertOnMention: boolean;
  alertOnBreaking: boolean;
  alertOnPriceChange?: number; // Percentage threshold
  notes?: string;
  lastMentionAt?: string;
  mentionCount: number;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════
// WATCHLIST OPERATIONS
// ═══════════════════════════════════════════════════════════════

export async function addToWatchlist(
  userId: string,
  item: Omit<WatchlistItem, 'id' | 'userId' | 'mentionCount' | 'createdAt'>
): Promise<WatchlistItem> {
  const { data, error } = await supabase
    .from('watchlist')
    .insert({
      user_id: userId,
      entity_type: item.entityType,
      entity_name: item.entityName,
      entity_id: item.entityId,
      keywords: item.keywords || [item.entityName.toLowerCase()],
      alert_on_mention: item.alertOnMention ?? true,
      alert_on_breaking: item.alertOnBreaking ?? true,
      alert_on_price_change: item.alertOnPriceChange,
      notes: item.notes,
      mention_count: 0,
    })
    .select()
    .single();

  if (error) throw error;

  // Record as interest
  await recordInterestSignal(userId, {
    type: 'subscribe',
    topic: item.entityName,
    category: mapEntityTypeToCategory(item.entityType),
    weight: 2,
  });

  return mapToWatchlistItem(data);
}

export async function removeFromWatchlist(
  userId: string,
  itemId: string
): Promise<void> {
  await supabase
    .from('watchlist')
    .delete()
    .eq('user_id', userId)
    .eq('id', itemId);
}

export async function getWatchlist(
  userId: string,
  entityType?: WatchlistEntityType
): Promise<WatchlistItem[]> {
  let query = supabase
    .from('watchlist')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (entityType) {
    query = query.eq('entity_type', entityType);
  }

  const { data } = await query;

  return (data || []).map(mapToWatchlistItem);
}

export async function updateWatchlistItem(
  itemId: string,
  updates: Partial<WatchlistItem>
): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};

  if (updates.alertOnMention !== undefined) dbUpdates.alert_on_mention = updates.alertOnMention;
  if (updates.alertOnBreaking !== undefined) dbUpdates.alert_on_breaking = updates.alertOnBreaking;
  if (updates.alertOnPriceChange !== undefined) dbUpdates.alert_on_price_change = updates.alertOnPriceChange;
  if (updates.keywords !== undefined) dbUpdates.keywords = updates.keywords;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

  await supabase
    .from('watchlist')
    .update(dbUpdates)
    .eq('id', itemId);
}

// ═══════════════════════════════════════════════════════════════
// WATCHLIST MATCHING
// ═══════════════════════════════════════════════════════════════

export async function findMatchingWatchlistItems(
  content: string,
  isBreaking: boolean = false
): Promise<{ item: WatchlistItem; userId: string }[]> {
  const contentLower = content.toLowerCase();

  // Get all watchlist items
  const { data: items } = await supabase
    .from('watchlist')
    .select('*')
    .eq(isBreaking ? 'alert_on_breaking' : 'alert_on_mention', true);

  if (!items) return [];

  const matches: { item: WatchlistItem; userId: string }[] = [];

  for (const item of items) {
    const keywords = item.keywords || [item.entity_name.toLowerCase()];

    const isMatch = keywords.some((keyword: string) =>
      contentLower.includes(keyword.toLowerCase())
    );

    if (isMatch) {
      matches.push({
        item: mapToWatchlistItem(item),
        userId: item.user_id,
      });

      // Update mention stats
      await supabase
        .from('watchlist')
        .update({
          last_mention_at: new Date().toISOString(),
          mention_count: item.mention_count + 1,
        })
        .eq('id', item.id);
    }
  }

  return matches;
}

// ═══════════════════════════════════════════════════════════════
// WATCHLIST ALERTS
// ═══════════════════════════════════════════════════════════════

export async function sendWatchlistAlerts(
  content: string,
  postId: string,
  isBreaking: boolean = false
): Promise<number> {
  const matches = await findMatchingWatchlistItems(content, isBreaking);

  if (matches.length === 0) return 0;

  const { getOpenClawClient } = await import('@/lib/openclaw/client');
  const client = getOpenClawClient();

  let sentCount = 0;

  for (const { item, userId } of matches) {
    // Get user's channel
    const { data: channel } = await supabase
      .from('user_channels')
      .select('channel, channel_id')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .maybeSingle();

    if (!channel) continue;

    const message = `🔔 *Watchlist Alert: ${item.entityName}*

${isBreaking ? '🚨 BREAKING: ' : ''}Có tin mới liên quan đến ${item.entityName}!

${content.slice(0, 200)}${content.length > 200 ? '...' : ''}

---
Manage: \`watch\` | Mute: \`watch mute ${item.entityName}\``;

    try {
      await client.send({
        channel: channel.channel,
        recipient: channel.channel_id,
        content: message,
      });
      sentCount++;
    } catch (error) {
      console.error(`Failed to send watchlist alert to ${userId}:`, error);
    }
  }

  return sentCount;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function mapToWatchlistItem(data: Record<string, unknown>): WatchlistItem {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    entityType: data.entity_type as WatchlistEntityType,
    entityName: data.entity_name as string,
    entityId: data.entity_id as string | undefined,
    keywords: (data.keywords || []) as string[],
    alertOnMention: data.alert_on_mention as boolean,
    alertOnBreaking: data.alert_on_breaking as boolean,
    alertOnPriceChange: data.alert_on_price_change as number | undefined,
    notes: data.notes as string | undefined,
    lastMentionAt: data.last_mention_at as string | undefined,
    mentionCount: data.mention_count as number,
    createdAt: data.created_at as string,
  };
}

function mapEntityTypeToCategory(type: WatchlistEntityType): string {
  const mapping: Record<WatchlistEntityType, string> = {
    company: 'startup',
    person: 'general',
    topic: 'general',
    stock: 'finance',
    crypto: 'crypto',
    product: 'gadget',
    event: 'general',
  };
  return mapping[type] || 'general';
}
