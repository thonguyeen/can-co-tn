import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/intents/[id]/comments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('intent_comments')
    .select('*')
    .eq('intent_id', id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST /api/intents/[id]/comments
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

  const body = await request.json();
  const { content, parent_id } = body;

  if (!content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('intent_comments')
    .insert({
      intent_id: id,
      user_id: user.id,
      content,
      parent_id: parent_id || null,
      is_bot: false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Increment comment count (best-effort)
  const { data: currentIntent } = await supabase
    .from('intents')
    .select('comment_count')
    .eq('id', id)
    .single();
  if (currentIntent) {
    await supabase
      .from('intents')
      .update({ comment_count: (currentIntent.comment_count || 0) + 1 })
      .eq('id', id);
  }

  return NextResponse.json(data, { status: 201 });
}
