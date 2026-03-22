import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateIntentEmbedding } from '@/lib/engine/matching';
import type { Intent } from '@/lib/engine/types';

// GET /api/intents/[id] — full detail with comments
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('intents')
    .select('*, intent_images(*)')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Không tìm thấy dữ liệu' }, { status: 404 });
  }

  // Fetch related data in parallel
  const [profileRes, commentsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .eq('id', data.user_id)
      .single(),
    supabase
      .from('intent_comments')
      .select('*, profiles:user_id(display_name)')
      .eq('intent_id', id)
      .order('created_at', { ascending: true }),
  ]);

  // Increment view count (best-effort)
  supabase
    .from('intents')
    .update({ view_count: (data.view_count || 0) + 1 })
    .eq('id', id)
    .then(() => {});

  const profile = profileRes.data;
  const comments = (commentsRes.data || []).map((c) => ({
    ...c,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: c.is_bot ? undefined : { name: (c as any).profiles?.display_name || 'Người dùng' },
  }));

  return NextResponse.json({
    ...data,
    user: {
      id: data.user_id,
      name: profile?.display_name || 'Người dùng',
      avatar_url: profile?.avatar_url || null,
      trust_score: data.trust_score,
      verification_level: data.verification_level,
    },
    images: data.intent_images || [],
    comments,
  });
}

// PUT /api/intents/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { raw_text, ...rest } = body;

  const updateData = { ...rest, updated_at: new Date().toISOString() };
  if (raw_text) updateData.raw_text = raw_text;

  const { data, error } = await supabase
    .from('intents')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Re-generate embedding if raw_text changed
  if (raw_text && data) {
    generateIntentEmbedding(data as Intent, supabase).catch(() => {});
  }

  return NextResponse.json(data);
}

// DELETE /api/intents/[id] — soft delete
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('intents')
    .update({ status: 'hidden', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
