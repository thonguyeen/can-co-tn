// ═══════════════════════════════════════════════════════
// CẦN & CÓ — OpenAI Engine (framework-agnostic)
// Ported from NHA.AI: apps/api/src/common/openai.service.ts
// ═══════════════════════════════════════════════════════

import OpenAI from 'openai';
import { HCM_DISTRICTS, type SearchIntent } from './types';

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey !== 'not-set') {
    client = new OpenAI({ apiKey });
    return client;
  }
  return null;
}

export function isConfigured(): boolean {
  return getClient() !== null;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const c = getClient();
  if (!c) throw new Error('OpenAI not configured');

  const response = await c.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  });

  return response.data[0].embedding;
}

export async function parseSearchIntent(query: string): Promise<SearchIntent> {
  const c = getClient();
  if (!c) return emptyIntent(query);

  try {
    const response = await c.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: `You are a Vietnamese intent search assistant for CẦN & CÓ platform.
Parse the user's natural language query into structured filters.
Respond ONLY with valid JSON, no markdown, no explanation.
JSON schema:
{
  "districts": string[] | null,
  "price_min": number | null,
  "price_max": number | null,
  "bedrooms": number | null,
  "bathrooms": number | null,
  "area_min": number | null,
  "area_max": number | null,
  "keywords": string[],
  "preferences": string[]
}

Notes:
- districts must be from this list: ${HCM_DISTRICTS.join(', ')}
- Prices are in VND. "tỷ" = 1,000,000,000. "triệu" = 1,000,000
- "2PN" or "2 phòng ngủ" → bedrooms: 2
- "studio" → bedrooms: 1
- "Thủ Đức" includes old "Quận 2", "Quận 9", "Thủ Đức"
- keywords: remaining search terms not captured by other fields
- preferences: inferred user preferences`,
        },
        { role: 'user', content: query },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return emptyIntent(query);

    const parsed = JSON.parse(content);
    return {
      districts: parsed.districts || null,
      price_min: parsed.price_min || null,
      price_max: parsed.price_max || null,
      bedrooms: parsed.bedrooms ?? null,
      bathrooms: parsed.bathrooms ?? null,
      area_min: parsed.area_min || null,
      area_max: parsed.area_max || null,
      keywords: parsed.keywords || [],
      preferences: parsed.preferences || [],
    };
  } catch {
    return emptyIntent(query);
  }
}

function emptyIntent(query: string): SearchIntent {
  return {
    districts: null,
    price_min: null,
    price_max: null,
    bedrooms: null,
    bathrooms: null,
    area_min: null,
    area_max: null,
    keywords: query.split(/\s+/).filter(Boolean),
    preferences: [],
  };
}

/**
 * Generate a title for an intent from raw_text
 */
export async function generateIntentTitle(rawText: string, type: 'CAN' | 'CO'): Promise<string> {
  const c = getClient();
  if (!c) {
    return rawText.slice(0, 100);
  }

  try {
    const response = await c.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 100,
      messages: [
        {
          role: 'system',
          content: `Tạo tiêu đề ngắn gọn (tối đa 80 ký tự) cho bài đăng ${type === 'CAN' ? 'CẦN' : 'CÓ'} trên mạng xã hội CẦN & CÓ. Chỉ trả về tiêu đề, không giải thích.`,
        },
        { role: 'user', content: rawText },
      ],
    });

    return response.choices[0]?.message?.content?.trim() || rawText.slice(0, 100);
  } catch {
    return rawText.slice(0, 100);
  }
}
