import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/matching — get matches for current user
export async function GET(_request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user's intents
  const { data: userIntents } = await supabase
    .from('intents')
    .select('id, type')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (!userIntents || userIntents.length === 0) {
    return NextResponse.json({ matches: [] });
  }

  const intentIds = userIntents.map((i) => i.id);

  // Get matches where user's intents are involved
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*, can_intent:intents!matches_can_intent_id_fkey(*), co_intent:intents!matches_co_intent_id_fkey(*)')
    .or(`can_intent_id.in.(${intentIds.join(',')}),co_intent_id.in.(${intentIds.join(',')})`)
    .order('similarity', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ matches: matches || [] });
}
