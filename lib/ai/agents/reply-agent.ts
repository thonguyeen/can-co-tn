import { chat } from '../client'
import { BOT_PERSONAS, getBotById } from '../prompts/bot-personas'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface CommentContext {
  postContent: string
  postVerificationStatus: string
  commentContent: string
  commenterName: string
  previousComments?: {
    author: string
    isBot: boolean
    content: string
  }[]
}

interface ReplyResult {
  success: boolean
  reply?: string
  error?: string
}

// ═══════════════════════════════════════════════════════════════
// REPLY GENERATION
// ═══════════════════════════════════════════════════════════════

export async function generateBotReply(
  botId: string,
  context: CommentContext
): Promise<ReplyResult> {
  try {
    const bot = getBotById(botId)
    if (!bot) {
      throw new Error(`Bot not found: ${botId}`)
    }

    const systemPrompt = buildReplySystemPrompt(bot)
    const userPrompt = buildReplyUserPrompt(context)

    const reply = await chat(systemPrompt, userPrompt, {
      maxTokens: 512,
      temperature: 0.7,
    })

    // Clean and validate reply
    const cleanedReply = cleanReply(reply)

    return {
      success: true,
      reply: cleanedReply,
    }
  } catch (error) {
    console.error('Reply generation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed',
    }
  }
}

function buildReplySystemPrompt(
  bot: (typeof BOT_PERSONAS)[keyof typeof BOT_PERSONAS]
): string {
  return `${bot.systemPrompt}

## TRẢ LỜI COMMENT

Bạn đang trả lời comment của người đọc trên bài viết của bạn.

### NGUYÊN TẮC:
1. Trả lời ngắn gọn (1-3 câu), thân thiện
2. Giữ đúng persona và expertise của bạn
3. Nếu không biết → thừa nhận, không bịa
4. Nếu câu hỏi ngoài expertise → gợi ý hỏi bot khác
5. Nếu comment toxic → lịch sự từ chối engage

### VÍ DỤ TRẢ LỜI TỐT:
- "Câu hỏi hay! Theo mình hiểu thì..."
- "Đúng rồi, bạn nêu điểm quan trọng. Thêm vào đó..."
- "Hmm câu này mình không chắc lắm. Có thể hỏi @lan_startup về business angle?"

### KHÔNG NÊN:
- Trả lời quá dài (>100 từ)
- Lặp lại nguyên văn bài viết
- Trả lời robot/generic
- Argue với người dùng`
}

function buildReplyUserPrompt(context: CommentContext): string {
  let prompt = `
═══════════════════════════════════════════════════════════════
BÀI VIẾT CỦA BẠN
═══════════════════════════════════════════════════════════════

${context.postContent}

Trạng thái: ${context.postVerificationStatus}

═══════════════════════════════════════════════════════════════
COMMENT CẦN TRẢ LỜI
═══════════════════════════════════════════════════════════════

Từ: ${context.commenterName}
Nội dung: "${context.commentContent}"
`

  if (context.previousComments && context.previousComments.length > 0) {
    prompt += `

═══════════════════════════════════════════════════════════════
COMMENTS TRƯỚC ĐÓ (context)
═══════════════════════════════════════════════════════════════

${context.previousComments.map((c) => `${c.author}${c.isBot ? ' [Bot]' : ''}: "${c.content}"`).join('\n')}
`
  }

  prompt += `

═══════════════════════════════════════════════════════════════
YÊU CẦU
═══════════════════════════════════════════════════════════════

Viết reply ngắn gọn (1-3 câu) cho comment trên.
Chỉ output nội dung reply, không có gì khác.
`

  return prompt
}

function cleanReply(reply: string): string {
  return reply
    .replace(/^["']|["']$/g, '') // Remove surrounding quotes
    .replace(/^\s*Reply:\s*/i, '') // Remove "Reply:" prefix
    .replace(/^\s*Bot:\s*/i, '') // Remove "Bot:" prefix
    .trim()
}

// ═══════════════════════════════════════════════════════════════
// SAVE REPLY TO DATABASE
// ═══════════════════════════════════════════════════════════════

export async function saveBotReply(
  postId: string,
  botId: string,
  content: string,
  parentCommentId?: string
): Promise<{ success: boolean; commentId?: string; error?: string }> {
  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        bot_id: botId,
        user_id: null,
        content: content,
        parent_id: parentCommentId || null,
      })
      .select('id')
      .single()

    if (error) throw error

    // Update comment count
    await supabase.rpc('increment_comments', { p_post_id: postId })

    return { success: true, commentId: data.id }
  } catch (error) {
    console.error('Save reply error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Save failed',
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// FULL REPLY FLOW
// ═══════════════════════════════════════════════════════════════

export async function processAndReplyToComment(commentId: string): Promise<{
  success: boolean
  replyId?: string
  error?: string
}> {
  try {
    const supabase = getSupabaseAdmin()

    // 1. Fetch the comment with context
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .select(
        `
        id,
        content,
        post_id,
        parent_id,
        user_id,
        profiles:user_id (display_name),
        posts:post_id (
          content,
          verification_status,
          bot_id
        )
      `
      )
      .eq('id', commentId)
      .single()

    if (commentError || !comment) {
      throw new Error('Comment not found')
    }

    // Skip if comment is from a bot
    if (!comment.user_id) {
      return { success: true } // Don't reply to bot comments
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const post = comment.posts as any
    const botId = post.bot_id

    // 2. Get previous comments for context
    const { data: previousComments } = await supabase
      .from('comments')
      .select(
        `
        content,
        user_id,
        bot_id,
        profiles:user_id (display_name),
        bots:bot_id (name)
      `
      )
      .eq('post_id', comment.post_id)
      .lt('created_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(5)

    // 3. Build context
    const context: CommentContext = {
      postContent: post.content,
      postVerificationStatus: post.verification_status,
      commentContent: comment.content,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      commenterName: (comment.profiles as any)?.display_name || 'Người dùng',
      previousComments: previousComments?.map((c) => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        author: c.bot_id
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (c.bots as any)?.name || 'Bot'
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (c.profiles as any)?.display_name || 'User',
        isBot: !!c.bot_id,
        content: c.content,
      })),
    }

    // 4. Generate reply
    const { success, reply, error } = await generateBotReply(botId, context)

    if (!success || !reply) {
      throw new Error(error || 'Failed to generate reply')
    }

    // 5. Save reply
    const saveResult = await saveBotReply(
      comment.post_id,
      botId,
      reply,
      comment.id // Reply to this comment
    )

    return {
      success: saveResult.success,
      replyId: saveResult.commentId,
      error: saveResult.error,
    }
  } catch (error) {
    console.error('Process reply error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Process failed',
    }
  }
}
