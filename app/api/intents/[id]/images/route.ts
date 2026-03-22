import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/intents/[id]/images — upload images
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify ownership
  const { data: intent } = await supabase
    .from('intents')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!intent) {
    return NextResponse.json({ error: 'Intent not found or not owned' }, { status: 404 });
  }

  const formData = await request.formData();
  const files = formData.getAll('images') as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: 'No images provided' }, { status: 400 });
  }

  const uploaded = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `intents/${id}/${Date.now()}_${i}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from('intent-images')
      .upload(path, buffer, { contentType: file.type });

    if (uploadError) continue;

    const { data: { publicUrl } } = supabase.storage
      .from('intent-images')
      .getPublicUrl(path);

    const { data: img } = await supabase
      .from('intent_images')
      .insert({ intent_id: id, url: publicUrl, display_order: i })
      .select()
      .single();

    if (img) uploaded.push(img);
  }

  return NextResponse.json({ images: uploaded }, { status: 201 });
}
