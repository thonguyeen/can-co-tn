// ═══════════════════════════════════════════════════════
// CẦN & CÓ — Agent Memory System
// Each bot remembers user patterns for personalized comments
// ═══════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js';

export interface AgentMemory {
  bot_id: string;
  user_id: string;
  memory_type: 'preference' | 'interaction' | 'insight' | 'pattern';
  content: string;
  confidence: number;
}

const MAX_MEMORIES_PER_BOT_USER = 10;

export async function saveMemory(
  botId: string, userId: string, type: string, content: string,
  confidence: number, intentId: string | null,
  supabase: SupabaseClient,
): Promise<void> {
  try {
    await supabase.from('agent_memory').upsert({
      bot_id: botId,
      user_id: userId,
      memory_type: type,
      content,
      confidence,
      source_intent_id: intentId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'bot_id,user_id,memory_type' });

    // Enforce rolling window
    const { data } = await supabase
      .from('agent_memory')
      .select('id')
      .eq('bot_id', botId)
      .eq('user_id', userId)
      .order('updated_at', { ascending: true });

    if (data && data.length > MAX_MEMORIES_PER_BOT_USER) {
      const toDelete = data.slice(0, data.length - MAX_MEMORIES_PER_BOT_USER).map((d) => d.id);
      await supabase.from('agent_memory').delete().in('id', toDelete);
    }
  } catch { /* non-critical */ }
}

export async function getMemories(
  botId: string, userId: string, supabase: SupabaseClient,
): Promise<AgentMemory[]> {
  try {
    const { data } = await supabase
      .from('agent_memory')
      .select('bot_id, user_id, memory_type, content, confidence')
      .eq('bot_id', botId)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(MAX_MEMORIES_PER_BOT_USER);

    return (data || []) as AgentMemory[];
  } catch {
    return [];
  }
}

export async function collectMemories(
  userId: string, event: string, data: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<void> {
  try {
    if (event === 'intent_created' && data.category === 'real_estate') {
      const district = data.district as string | null;
      const price = (data.price || data.price_max) as number | null;
      const intentId = data.id as string;

      if (district) {
        await saveMemory('nha_advisor', userId, 'preference',
          `Quan tâm ${district}`, 0.8, intentId, supabase);
      }
      if (price) {
        const fmted = price >= 1e9 ? `${(price / 1e9).toFixed(1)} tỷ` : `${Math.round(price / 1e6)} triệu`;
        await saveMemory('nha_advisor', userId, 'pattern',
          `Budget/giá gần nhất: ${fmted}`, 0.7, intentId, supabase);
      }

      await saveMemory('market_analyst', userId, 'interaction',
        `Posted ${data.type} in ${district || 'unknown'}`, 0.6, intentId, supabase);
    }

    if (event === 'intent_created') {
      await saveMemory('concierge', userId, 'insight',
        `Đã đăng intent (${data.type})`, 0.8, data.id as string, supabase);
    }

    if (event === 'verification_completed') {
      await saveMemory('trust_checker', userId, 'insight',
        `Completed ${data.type} verification`, 0.9, null, supabase);
    }
  } catch { /* non-critical */ }
}
