import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/chat/conversations — list user's conversations with preview
export async function GET(_request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch conversations where user is participant
  const { data: conversations, error } = await supabase
    .from('conversations')
    .select('*, intent:intents(id, title, type, raw_text)')
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!conversations || conversations.length === 0) {
    return NextResponse.json([]);
  }

  // Batch fetch: other party profiles + last message + unread count
  const otherUserIds = conversations.map((c) =>
    c.user_a === user.id ? c.user_b : c.user_a,
  );
  const convIds = conversations.map((c) => c.id);

  const [profilesRes, messagesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', [...new Set(otherUserIds)]),
    // Get latest message per conversation
    supabase
      .from('messages')
      .select('conversation_id, content, created_at, sender_id')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false }),
  ]);

  const profileMap = new Map(
    (profilesRes.data || []).map((p) => [p.id, p]),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastMessageMap = new Map<string, any>();
  for (const msg of messagesRes.data || []) {
    if (!lastMessageMap.has(msg.conversation_id)) {
      lastMessageMap.set(msg.conversation_id, msg);
    }
  }

  // Count unread per conversation
  const { data: unreadData } = await supabase
    .from('messages')
    .select('conversation_id')
    .in('conversation_id', convIds)
    .neq('sender_id', user.id)
    .is('read_at', null);

  const unreadMap = new Map<string, number>();
  for (const u of unreadData || []) {
    unreadMap.set(u.conversation_id, (unreadMap.get(u.conversation_id) || 0) + 1);
  }

  const enriched = conversations.map((conv) => {
    const otherUserId = conv.user_a === user.id ? conv.user_b : conv.user_a;
    const profile = profileMap.get(otherUserId);
    const lastMessage = lastMessageMap.get(conv.id);

    return {
      id: conv.id,
      intent_id: conv.intent_id,
      intent: conv.intent,
      other_party: {
        id: otherUserId,
        name: profile?.display_name || 'Người dùng',
        avatar_url: profile?.avatar_url || null,
      },
      last_message: lastMessage || null,
      unread_count: unreadMap.get(conv.id) || 0,
      last_message_at: conv.last_message_at,
      created_at: conv.created_at,
    };
  });

  return NextResponse.json(enriched);
}

// POST /api/chat/conversations — create or find conversation
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { intent_id, other_user_id } = body;

  if (!other_user_id) {
    return NextResponse.json({ error: 'other_user_id required' }, { status: 400 });
  }

  if (other_user_id === user.id) {
    return NextResponse.json({ error: 'Không thể chat với chính mình' }, { status: 400 });
  }

  // Check if conversation already exists (either direction)
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .or(`and(user_a.eq.${user.id},user_b.eq.${other_user_id}),and(user_a.eq.${other_user_id},user_b.eq.${user.id})`)
    .eq('intent_id', intent_id || '')
    .maybeSingle();

  if (existing) {
    return NextResponse.json(existing);
  }

  // Also check without intent_id constraint for general chat
  if (intent_id) {
    const { data: existingGeneral } = await supabase
      .from('conversations')
      .select('*')
      .or(`and(user_a.eq.${user.id},user_b.eq.${other_user_id}),and(user_a.eq.${other_user_id},user_b.eq.${user.id})`)
      .eq('intent_id', intent_id)
      .maybeSingle();

    if (existingGeneral) {
      return NextResponse.json(existingGeneral);
    }
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      intent_id: intent_id || null,
      user_a: user.id,
      user_b: other_user_id,
    })
    .select()
    .single();

  if (error) {
    // Unique constraint violated — conversation exists
    if (error.code === '23505') {
      const { data: found } = await supabase
        .from('conversations')
        .select('*')
        .or(`and(user_a.eq.${user.id},user_b.eq.${other_user_id}),and(user_a.eq.${other_user_id},user_b.eq.${user.id})`)
        .limit(1)
        .single();
      if (found) return NextResponse.json(found);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
