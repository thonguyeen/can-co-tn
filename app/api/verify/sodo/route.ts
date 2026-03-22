import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processSodo } from '@/lib/engine/ocr';
import { calculateTrustScore, calculateLevel } from '@/lib/engine/trust';
import type { Verification } from '@/lib/engine/types';

// POST /api/verify/sodo — upload + OCR sổ đỏ
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('image') as File;
  const intentId = formData.get('intent_id') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'image file required' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const path = `sodo/${user.id}/${Date.now()}.jpg`;
  await supabase.storage.from('verification-scans').upload(path, buffer, { contentType: file.type });
  const { data: { publicUrl } } = supabase.storage.from('verification-scans').getPublicUrl(path);

  const ocrData = await processSodo(buffer);

  const { data: verification, error } = await supabase
    .from('verifications')
    .insert({
      user_id: user.id,
      intent_id: intentId || null,
      type: 'sodo',
      status: 'pending',
      data: ocrData,
      image_url: publicUrl,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: allVerifications } = await supabase
    .from('verifications')
    .select('*')
    .eq('user_id', user.id);

  if (allVerifications) {
    const score = calculateTrustScore(allVerifications as Verification[]);
    const level = calculateLevel(score);
    await supabase.from('profiles').update({ trust_score: score, verification_level: level }).eq('id', user.id);
  }

  return NextResponse.json({ verification, ocr: ocrData }, { status: 201 });
}
