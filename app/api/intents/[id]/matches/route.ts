import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/intents/[id]/matches — get matches for a specific intent
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  // Get intent type to know which FK to query
  const { data: intent } = await supabase
    .from('intents')
    .select('id, type')
    .eq('id', id)
    .single();

  if (!intent) {
    return NextResponse.json({ matches: [] });
  }

  // Fetch matches with the other side populated
  const fkColumn = intent.type === 'CAN' ? 'can_intent_id' : 'co_intent_id';

  const { data: matches, error } = await supabase
    .from('matches')
    .select('*, can_intent:intents!matches_can_intent_id_fkey(id, title, raw_text, type, price, price_min, price_max, district, trust_score, verification_level, user_id), co_intent:intents!matches_co_intent_id_fkey(id, title, raw_text, type, price, price_min, price_max, district, trust_score, verification_level, user_id)')
    .eq(fkColumn, id)
    .order('similarity', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ matches: matches || [] });
}
