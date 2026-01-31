// POST /api/openclaw/webhook - Receive messages from channels
// Phase 13: Multi-Channel Chat Integration

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  isUsingOpenClaw,
  getSessionManager,
  getOpenClawClient,
  ChannelType,
} from '@/lib/openclaw';
import { handleIncomingMessage } from '@/lib/openclaw/message-handler';
import { OpenClawChannel } from '@/lib/openclaw/types';

export const maxDuration = 30; // 30 seconds timeout

interface WebhookPayload {
  type: 'message' | 'reaction' | 'follow' | 'unfollow';
  channel: ChannelType;
  data: {
    messageId?: string;
    senderId: string;
    senderName: string;
    content?: string;
    replyToPostId?: string;
    replyToCommentId?: string;
    reaction?: string;
    timestamp: number;
  };
  signature?: string;
}

// Verify webhook signature (if configured)
function verifySignature(payload: string, signature: string): boolean {
  const secret = process.env.OPENCLAW_WEBHOOK_SECRET;
  if (!secret) return true; // No verification if no secret configured

  // Simple HMAC verification (implement proper verification based on OpenClaw's signing method)
  const crypto = require('crypto');
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return signature === expectedSig;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body: WebhookPayload = JSON.parse(rawBody);

    // Verify signature if provided
    if (body.signature && !verifySignature(rawBody, body.signature)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    if (!isUsingOpenClaw()) {
      return NextResponse.json(
        { error: 'OpenClaw is disabled' },
        { status: 400 }
      );
    }

    console.log(`[OpenClaw Webhook] Received ${body.type} from ${body.channel}`);

    switch (body.type) {
      case 'message':
        return handleMessage(body);
      case 'reaction':
        return handleReaction(body);
      case 'follow':
      case 'unfollow':
        return handleFollow(body);
      default:
        return NextResponse.json({ received: true, processed: false });
    }
  } catch (error) {
    console.error('[OpenClaw Webhook] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function handleMessage(payload: WebhookPayload): Promise<NextResponse> {
  const { data, channel } = payload;

  if (!data.content) {
    return NextResponse.json({ received: true, processed: false });
  }

  const supabase = await createClient();

  // Check if this is a reply to a FACEBOT post
  if (data.replyToPostId) {
    // Create comment in database
    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        post_id: data.replyToPostId,
        content: data.content,
        author_name: data.senderName,
        author_external_id: `${channel}:${data.senderId}`,
        source_channel: channel,
        source_message_id: data.messageId,
        created_at: new Date(data.timestamp).toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[OpenClaw Webhook] Failed to create comment:', error);
      return NextResponse.json(
        { error: 'Failed to create comment' },
        { status: 500 }
      );
    }

    // Trigger bot reply (async)
    triggerBotReply(data.replyToPostId, comment.id, data.content).catch(
      console.error
    );

    return NextResponse.json({
      received: true,
      processed: true,
      action: 'comment_created',
      commentId: comment.id,
    });
  }

  // Check if this is a reply to a comment
  if (data.replyToCommentId) {
    const { data: reply, error } = await supabase
      .from('comments')
      .insert({
        parent_id: data.replyToCommentId,
        content: data.content,
        author_name: data.senderName,
        author_external_id: `${channel}:${data.senderId}`,
        source_channel: channel,
        source_message_id: data.messageId,
        created_at: new Date(data.timestamp).toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[OpenClaw Webhook] Failed to create reply:', error);
      return NextResponse.json(
        { error: 'Failed to create reply' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      received: true,
      processed: true,
      action: 'reply_created',
      replyId: reply.id,
    });
  }

  // Phase 13: Handle as multi-channel chat command
  try {
    const client = getOpenClawClient();
    const message = client.parseWebhookMessage({
      id: data.messageId,
      channel: channel as OpenClawChannel,
      sender: data.senderId,
      senderName: data.senderName,
      content: data.content,
      timestamp: new Date(data.timestamp).toISOString(),
    });

    const result = await handleIncomingMessage(message);

    // Send response back via OpenClaw
    if (result.response) {
      await client.send({
        channel: channel as OpenClawChannel,
        recipient: data.senderId,
        content: result.response,
        format: result.canvas ? 'canvas' : 'text',
        canvas: result.canvas,
        replyTo: data.messageId,
      });
    }

    return NextResponse.json({
      received: true,
      processed: true,
      action: 'chat_command',
    });
  } catch (error) {
    console.error('[OpenClaw Webhook] Chat command error:', error);
    return NextResponse.json({
      received: true,
      processed: false,
      reason: 'chat_command_error',
    });
  }
}

async function handleReaction(payload: WebhookPayload): Promise<NextResponse> {
  const { data, channel } = payload;

  if (!data.replyToPostId || !data.reaction) {
    return NextResponse.json({ received: true, processed: false });
  }

  const supabase = await createClient();

  // Map channel emoji to FACEBOT reaction type
  const reactionMap: Record<string, string> = {
    '❤️': 'heart',
    '👍': 'like',
    '😍': 'love',
    '💡': 'insight',
    '😂': 'haha',
    '🤔': 'think',
    '😠': 'angry',
    '🔥': 'fire',
    '🤯': 'mindblown',
  };

  const reactionType = reactionMap[data.reaction] || 'like';

  const { error } = await supabase.from('reactions').upsert(
    {
      post_id: data.replyToPostId,
      user_external_id: `${channel}:${data.senderId}`,
      type: reactionType,
      source_channel: channel,
    },
    {
      onConflict: 'post_id,user_external_id',
    }
  );

  if (error) {
    console.error('[OpenClaw Webhook] Failed to create reaction:', error);
    return NextResponse.json(
      { error: 'Failed to create reaction' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    received: true,
    processed: true,
    action: 'reaction_added',
    reactionType,
  });
}

async function handleFollow(payload: WebhookPayload): Promise<NextResponse> {
  // Log follow/unfollow for analytics
  console.log(
    `[OpenClaw Webhook] ${payload.type}: ${payload.data.senderName} on ${payload.channel}`
  );

  return NextResponse.json({
    received: true,
    processed: true,
    action: payload.type,
  });
}

async function triggerBotReply(
  postId: string,
  commentId: string,
  commentContent: string
): Promise<void> {
  const supabase = await createClient();

  // Get post details
  const { data: post } = await supabase
    .from('posts')
    .select('content, bot_handle')
    .eq('id', postId)
    .single();

  if (!post?.bot_handle) return;

  // Generate bot reply
  const sessionManager = getSessionManager();
  const reply = await sessionManager.generateReply(
    post.bot_handle,
    post.content,
    commentContent
  );

  // Save reply to database
  const { data: botReply } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      parent_id: commentId,
      content: reply,
      bot_handle: post.bot_handle,
      is_bot: true,
    })
    .select()
    .single();

  if (!botReply) return;

  // Distribute reply back to channels
  const client = getOpenClawClient();
  // Implementation depends on OpenClaw's channel reply mechanism
}
