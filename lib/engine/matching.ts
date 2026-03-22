// ═══════════════════════════════════════════════════════
// CẦN & CÓ — Matching Engine (framework-agnostic)
// Matches CẦN intents with CÓ intents + bot comments
// ═══════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js';
import { generateEmbedding, isConfigured } from './openai';
import type { Intent, Match } from './types';

export interface MatchResult {
  intent: Intent;
  similarity: number;
  explanation: string;
  matched_criteria: string[];
}

/**
 * Format price in VND to Vietnamese display
 */
function formatPrice(price: number): string {
  if (price >= 1_000_000_000) {
    const ty = price / 1_000_000_000;
    return `${ty % 1 === 0 ? ty : ty.toFixed(1)} tỷ`;
  }
  return `${Math.round(price / 1_000_000)} triệu`;
}

/**
 * Build text representation of an intent for embedding
 */
export function buildIntentText(intent: Intent): string {
  const parts = [
    intent.type === 'CAN' ? 'Cần tìm:' : 'Đang có:',
    intent.title || intent.raw_text,
    intent.district ? `Khu vực: ${intent.district}, ${intent.ward || ''}, ${intent.city}` : '',
    intent.price ? `Giá: ${formatPrice(intent.price)}` : '',
    intent.price_min && intent.price_max
      ? `Ngân sách: ${formatPrice(intent.price_min)} - ${formatPrice(intent.price_max)}`
      : '',
  ];

  const pd = intent.parsed_data as Record<string, unknown>;
  if (pd.bedrooms) parts.push(`${pd.bedrooms} phòng ngủ`);
  if (pd.area) parts.push(`${pd.area}m²`);
  if (pd.project_name) parts.push(`Dự án: ${pd.project_name}`);

  return parts.filter(Boolean).join('. ').slice(0, 2000);
}

/**
 * Generate and store embedding for an intent
 */
export async function generateIntentEmbedding(
  intent: Intent,
  supabase: SupabaseClient,
): Promise<void> {
  if (!isConfigured()) return;

  try {
    const text = buildIntentText(intent);
    const embedding = await generateEmbedding(text);

    await supabase
      .from('intent_embeddings')
      .upsert(
        {
          intent_id: intent.id,
          embedding: embedding as unknown as string,
          text_input: text,
        },
        { onConflict: 'intent_id' },
      );
  } catch {
    // Non-critical
  }
}

// ═══════════════════════════════════════════════════════
// Scoring + Explanation
// ═══════════════════════════════════════════════════════

function calculateMatchScore(source: Intent, target: Intent): { score: number; criteria: string[] } {
  let score = 0.5;
  const criteria: string[] = [];

  // District match: +0.2
  if (source.district && target.district && source.district === target.district) {
    score += 0.2;
    criteria.push('district');
  }

  // Price overlap: +0.2 (exact) or +0.1 (fuzzy 20%)
  const canPriceMin = source.type === 'CAN' ? source.price_min : target.price_min;
  const canPriceMax = source.type === 'CAN' ? source.price_max : target.price_max;
  const coPrice = source.type === 'CO' ? source.price : target.price;

  if (coPrice && canPriceMin && canPriceMax) {
    if (coPrice >= canPriceMin && coPrice <= canPriceMax) {
      score += 0.2;
      criteria.push('price');
    } else if (coPrice >= canPriceMin * 0.8 && coPrice <= canPriceMax * 1.2) {
      score += 0.1;
      criteria.push('price_fuzzy');
    }
  }

  // Bedrooms match: +0.1
  const srcBedrooms = (source.parsed_data as Record<string, unknown>)?.bedrooms;
  const tgtBedrooms = (target.parsed_data as Record<string, unknown>)?.bedrooms;
  if (srcBedrooms && tgtBedrooms && srcBedrooms === tgtBedrooms) {
    score += 0.1;
    criteria.push('bedrooms');
  }

  // Trust boost
  const coVerification = source.type === 'CO' ? source.verification_level : target.verification_level;
  if (coVerification === 'verified') {
    score += 0.05;
    criteria.push('verified');
  } else if (coVerification === 'kyc') {
    score += 0.02;
  }

  return { score: Math.min(score, 1.0), criteria };
}

function generateMatchExplanation(can: Intent, co: Intent, criteria: string[]): string {
  const parts: string[] = [];

  if (criteria.includes('district')) {
    parts.push(`cùng khu vực ${co.district}`);
  }
  if (criteria.includes('bedrooms')) {
    const bd = (co.parsed_data as Record<string, unknown>)?.bedrooms;
    if (bd) parts.push(`${bd} phòng ngủ`);
  }
  if (criteria.includes('price') || criteria.includes('price_fuzzy')) {
    if (co.price) {
      parts.push(`giá ${formatPrice(co.price)}${can.price_min && can.price_max ? ` trong budget ${formatPrice(can.price_min)}-${formatPrice(can.price_max)}` : ''}`);
    }
  }
  if (criteria.includes('verified')) {
    parts.push('chủ đã xác thực');
  }

  return parts.length > 0
    ? `Phù hợp vì: ${parts.join(', ')}`
    : 'Cùng danh mục và khu vực';
}

// ═══════════════════════════════════════════════════════
// Core Matching Functions
// ═══════════════════════════════════════════════════════

/**
 * Find CÓ intents matching a CẦN intent
 */
export async function findMatchesForCan(
  canIntent: Intent,
  supabase: SupabaseClient,
  limit = 10,
): Promise<MatchResult[]> {
  let query = supabase
    .from('intents')
    .select('*, intent_images(*)')
    .eq('type', 'CO')
    .eq('status', 'active')
    .eq('category', canIntent.category)
    .neq('user_id', canIntent.user_id)
    .limit(limit);

  if (canIntent.district) {
    query = query.eq('district', canIntent.district);
  }
  if (canIntent.price_min) {
    query = query.gte('price', Math.round(canIntent.price_min * 0.8));
  }
  if (canIntent.price_max) {
    query = query.lte('price', Math.round(canIntent.price_max * 1.2));
  }

  const { data: coIntents } = await query.order('trust_score', { ascending: false });

  if (!coIntents || coIntents.length === 0) return [];

  return coIntents
    .map((co) => {
      const typedCo = co as unknown as Intent;
      const { score, criteria } = calculateMatchScore(canIntent, typedCo);
      return {
        intent: typedCo,
        similarity: score,
        explanation: generateMatchExplanation(canIntent, typedCo, criteria),
        matched_criteria: criteria,
      };
    })
    .sort((a, b) => b.similarity - a.similarity);
}

/**
 * Find CẦN intents matching a CÓ intent
 */
export async function findMatchesForCo(
  coIntent: Intent,
  supabase: SupabaseClient,
  limit = 10,
): Promise<MatchResult[]> {
  let query = supabase
    .from('intents')
    .select('*, intent_images(*)')
    .eq('type', 'CAN')
    .eq('status', 'active')
    .eq('category', coIntent.category)
    .neq('user_id', coIntent.user_id)
    .limit(limit);

  if (coIntent.district) {
    query = query.eq('district', coIntent.district);
  }
  // CẦN intents: coIntent.price should fall within their price_min..price_max
  // Supabase: price_min <= coPrice AND price_max >= coPrice (with 20% fuzzy)
  if (coIntent.price) {
    query = query.lte('price_min', Math.round(coIntent.price * 1.2));
    query = query.gte('price_max', Math.round(coIntent.price * 0.8));
  }

  const { data: canIntents } = await query.order('trust_score', { ascending: false });

  if (!canIntents || canIntents.length === 0) return [];

  return canIntents
    .map((can) => {
      const typedCan = can as unknown as Intent;
      const { score, criteria } = calculateMatchScore(coIntent, typedCan);
      return {
        intent: typedCan,
        similarity: score,
        explanation: generateMatchExplanation(typedCan, coIntent, criteria),
        matched_criteria: criteria,
      };
    })
    .sort((a, b) => b.similarity - a.similarity);
}

// ═══════════════════════════════════════════════════════
// Match Persistence
// ═══════════════════════════════════════════════════════

export async function saveMatches(
  canIntentId: string,
  coIntentId: string,
  similarity: number,
  explanation: string,
  supabase: SupabaseClient,
): Promise<Match | null> {
  const { data, error } = await supabase
    .from('matches')
    .upsert(
      {
        can_intent_id: canIntentId,
        co_intent_id: coIntentId,
        similarity,
        explanation,
        status: 'suggested',
      },
      { onConflict: 'can_intent_id,co_intent_id' },
    )
    .select()
    .single();

  if (error) return null;
  return data as Match;
}

// ═══════════════════════════════════════════════════════
// Match Advisor Bot
// ═══════════════════════════════════════════════════════

/**
 * Create bot comment on an intent after matching
 */
export async function createMatchBotComment(
  intentId: string,
  intentType: 'CAN' | 'CO',
  matches: MatchResult[],
  supabase: SupabaseClient,
): Promise<void> {
  // Anti-spam: check if bot already commented
  const { data: existing } = await supabase
    .from('intent_comments')
    .select('id')
    .eq('intent_id', intentId)
    .eq('is_bot', true)
    .eq('bot_name', 'match_advisor')
    .limit(1);

  if (existing && existing.length > 0) {
    // Update existing comment instead of creating new
    const content = buildBotCommentContent(intentType, matches);
    await supabase
      .from('intent_comments')
      .update({ content })
      .eq('id', existing[0].id);
    return;
  }

  const content = buildBotCommentContent(intentType, matches);

  await supabase.from('intent_comments').insert({
    intent_id: intentId,
    is_bot: true,
    bot_name: 'match_advisor',
    content,
  });
}

function buildBotCommentContent(intentType: 'CAN' | 'CO', matches: MatchResult[]): string {
  if (matches.length === 0) {
    return 'Chưa tìm thấy match phù hợp. Đang theo dõi — sẽ thông báo ngay khi có người đăng.';
  }

  if (intentType === 'CAN') {
    const list = matches.slice(0, 3).map((m, i) => {
      const co = m.intent;
      const price = co.price ? formatPrice(co.price) : '';
      const trust = co.verification_level === 'verified' ? ' ✅'
        : co.verification_level === 'kyc' ? ' 🟡' : '';
      const title = co.title || co.raw_text?.slice(0, 40) || 'Tin đăng';
      return `${i + 1}. ${title}${price ? ` (${price})` : ''}${trust}`;
    }).join('\n');

    const pct = Math.round(matches[0].similarity * 100);
    return `Tìm thấy ${matches.length} tin phù hợp nhu cầu của bạn:\n${list}\nĐộ phù hợp cao nhất: ${pct}%`;
  }

  // CÓ intent
  return `${matches.length} người đang tìm kiếm phù hợp với tin của bạn. Tin đã được gợi ý cho họ.`;
}

/**
 * Notify the OTHER side's intents about the match
 */
export async function notifyMatchedIntents(
  sourceIntentType: 'CAN' | 'CO',
  matches: MatchResult[],
  supabase: SupabaseClient,
): Promise<void> {
  for (const match of matches.slice(0, 3)) {
    // Check if bot already commented on the other intent
    const { data: existing } = await supabase
      .from('intent_comments')
      .select('id')
      .eq('intent_id', match.intent.id)
      .eq('is_bot', true)
      .eq('bot_name', 'match_advisor')
      .limit(1);

    if (existing && existing.length > 0) continue; // Anti-spam

    const pct = Math.round(match.similarity * 100);
    const content = sourceIntentType === 'CAN'
      ? `Có người đang tìm mua phù hợp với tin của bạn. Độ phù hợp: ${pct}%`
      : `Có tin mới phù hợp nhu cầu của bạn. Độ phù hợp: ${pct}%`;

    await supabase.from('intent_comments').insert({
      intent_id: match.intent.id,
      is_bot: true,
      bot_name: 'match_advisor',
      content,
    });
  }
}
