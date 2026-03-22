import { NextRequest, NextResponse } from 'next/server';
import { parseSearchIntent, isConfigured } from '@/lib/engine/openai';
import { formatPrice, formatPriceRange } from '@/lib/intent-utils';

// POST /api/intents/parse — AI parse raw_text into tags (no DB write)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { raw_text } = body;

    if (!raw_text || raw_text.length < 10) {
      return NextResponse.json({ tags: [] });
    }

    if (!isConfigured()) {
      return NextResponse.json({ tags: [], ai: false });
    }

    const intent = await parseSearchIntent(raw_text);

    const tags: { icon: string; label: string; type: string }[] = [];

    if (intent.districts && intent.districts.length > 0) {
      for (const d of intent.districts) {
        tags.push({ icon: '📍', label: d, type: 'district' });
      }
    }
    if (intent.bedrooms) {
      tags.push({ icon: '🛏', label: `${intent.bedrooms} PN`, type: 'bedrooms' });
    }
    if (intent.bathrooms) {
      tags.push({ icon: '🚿', label: `${intent.bathrooms} WC`, type: 'bathrooms' });
    }
    if (intent.area_min || intent.area_max) {
      const area = intent.area_min && intent.area_max
        ? `${intent.area_min}-${intent.area_max}m²`
        : intent.area_min ? `từ ${intent.area_min}m²` : `đến ${intent.area_max}m²`;
      tags.push({ icon: '📐', label: area, type: 'area' });
    }
    if (intent.price_min || intent.price_max) {
      const priceLabel = formatPriceRange(intent.price_min, intent.price_max);
      if (priceLabel) tags.push({ icon: '💰', label: priceLabel, type: 'price' });
    }
    for (const kw of (intent.keywords || []).slice(0, 3)) {
      tags.push({ icon: '🎯', label: kw, type: 'keyword' });
    }

    return NextResponse.json({ tags, intent, ai: true });
  } catch {
    return NextResponse.json({ tags: [], ai: false });
  }
}
