import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/chat/[id]/messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const before = searchParams.get('before');

  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark other person's messages as read (side effect)
  supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', id)
    .neq('sender_id', user.id)
    .is('read_at', null)
    .then(() => {});

  return NextResponse.json(data || []);
}

// POST /api/chat/[id]/messages — send message
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
  const { content } = body;

  if (!content || content.trim().length === 0) {
    return NextResponse.json({ error: 'Nội dung không được trống' }, { status: 400 });
  }
  if (content.length > 2000) {
    return NextResponse.json({ error: 'Tin nhắn quá dài (tối đa 2000 ký tự)' }, { status: 400 });
  }

  // Insert message
  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: id,
      sender_id: user.id,
      content: content.trim(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update conversation last_message_at
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', id);

  // Create notification for recipient (fire-and-forget)
  createMessageNotification(id, user.id, content.trim(), supabase).catch(() => {});

  return NextResponse.json(message, { status: 201 });
}

async function createMessageNotification(
  conversationId: string,
  senderId: string,
  content: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  // Get conversation to find recipient
  const { data: conv } = await supabase
    .from('conversations')
    .select('user_a, user_b')
    .eq('id', conversationId)
    .single();

  if (!conv) return;

  const recipientId = conv.user_a === senderId ? conv.user_b : conv.user_a;

  // Get sender name
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', senderId)
    .single();

  const senderName = profile?.display_name || 'Người dùng';

  await supabase.from('notifications').insert({
    user_id: recipientId,
    type: 'new_message',
    title: `Tin nhắn mới từ ${senderName}`,
    message: content.slice(0, 100),
    link: `/can-co/chat/${conversationId}`,
  });
}
