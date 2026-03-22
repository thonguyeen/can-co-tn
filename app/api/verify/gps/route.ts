import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyProximity, isAccuracyAcceptable } from '@/lib/engine/gps';
import { calculateTrustScore, calculateLevel } from '@/lib/engine/trust';
import type { Verification } from '@/lib/engine/types';

// POST /api/verify/gps — GPS verification
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { intent_id, user_lat, user_lng, accuracy } = body;

  if (!intent_id || user_lat == null || user_lng == null) {
    return NextResponse.json({ error: 'intent_id, user_lat, user_lng required' }, { status: 400 });
  }

  if (accuracy && !isAccuracyAcceptable(accuracy)) {
    return NextResponse.json({ error: 'GPS accuracy too low. Vui lòng thử lại ở nơi thoáng hơn.' }, { status: 400 });
  }

  // Get intent location
  const { data: intent } = await supabase
    .from('intents')
    .select('lat, lng')
    .eq('id', intent_id)
    .single();

  if (!intent || !intent.lat || !intent.lng) {
    return NextResponse.json({ error: 'Intent has no location data' }, { status: 400 });
  }

  const result = verifyProximity(user_lat, user_lng, intent.lat, intent.lng);

  const { data: verification, error } = await supabase
    .from('verifications')
    .insert({
      user_id: user.id,
      intent_id,
      type: 'gps',
      status: result.isNear ? 'approved' : 'rejected',
      data: { distance: result.distance, isNear: result.isNear },
      gps_lat: user_lat,
      gps_lng: user_lng,
      gps_accuracy: accuracy || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Recalculate trust
  const { data: allVerifications } = await supabase
    .from('verifications')
    .select('*')
    .eq('user_id', user.id);

  if (allVerifications) {
    const score = calculateTrustScore(allVerifications as Verification[]);
    const level = calculateLevel(score);
    await supabase.from('profiles').update({ trust_score: score, verification_level: level }).eq('id', user.id);
  }

  return NextResponse.json({ verification, gps: result }, { status: 201 });
}
