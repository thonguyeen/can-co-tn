import { chat } from '../client'
import { BOT_PERSONAS } from '../prompts/bot-personas'
import { assignBotToNews } from './bot-assigner'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface RawNewsWithDetails {
  id: string
  original_url: string
  original_title: string
  original_content: string | null
  original_published_at: string | null
  sources: {
    name: string
    credibility_score: number
    category: string[]
  }
}

interface VerificationData {
  verification_status: string
  verification_note: string
  confidence_score: number
  key_facts: string[]
}

interface GeneratedPost {
  botId: string
  botHandle: string
  content: string
  verificationStatus: string
  verificationNote: string
  sources: { url: string; title: string; credibility: number }[]
  rawNewsIds: string[]
}

// ═══════════════════════════════════════════════════════════════
// MAIN GENERATION FUNCTION
// ═══════════════════════════════════════════════════════════════

export async function generatePostFromNews(
  rawNewsId: string,
  verificationData?: VerificationData
): Promise<{ success: boolean; post?: GeneratedPost; error?: string }> {
  try {
    const supabase = getSupabaseAdmin()

    // 1. Fetch raw news
    const { data: rawNews, error } = await supabase
      .from('raw_news')
      .select(
        `
        *,
        sources (name, credibility_score, category)
      `
      )
      .eq('id', rawNewsId)
      .single()

    if (error || !rawNews) {
      throw new Error(`Raw news not found: ${rawNewsId}`)
    }

    // 2. Assign to appropriate bot
    const assignment = assignBotToNews(rawNews as RawNewsWithDetails)
    const botPersona = BOT_PERSONAS[assignment.botHandle]

    if (!botPersona) {
      throw new Error(`Bot not found: ${assignment.botHandle}`)
    }

    // 3. Generate post content using AI
    const generatedContent = await generateContent(
      rawNews as RawNewsWithDetails,
      botPersona,
      verificationData
    )

    // 4. Prepare post data
    const post: GeneratedPost = {
      botId: assignment.botId,
      botHandle: assignment.botHandle,
      content: generatedContent,
      verificationStatus: verificationData?.verification_status || 'unverified',
      verificationNote:
        verificationData?.verification_note || 'Đang chờ xác minh',
      sources: [
        {
          url: rawNews.original_url,
          title: rawNews.sources.name,
          credibility: rawNews.sources.credibility_score,
        },
      ],
      rawNewsIds: [rawNewsId],
    }

    return { success: true, post }
  } catch (error) {
    console.error('Post generation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed',
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// CONTENT GENERATION
// ═══════════════════════════════════════════════════════════════

async function generateContent(
  news: RawNewsWithDetails,
  bot: (typeof BOT_PERSONAS)[keyof typeof BOT_PERSONAS],
  verification?: VerificationData
): Promise<string> {
  const prompt = `
Viết lại tin tức sau theo phong cách của bạn.

═══════════════════════════════════════════════════════════════
TIN GỐC
═══════════════════════════════════════════════════════════════

TIÊU ĐỀ: ${news.original_title}

NỘI DUNG:
${news.original_content || 'Không có nội dung chi tiết, chỉ viết dựa trên tiêu đề.'}

NGUỒN: ${news.sources.name}
NGÀY: ${news.original_published_at || 'Không rõ'}

${
  verification
    ? `
═══════════════════════════════════════════════════════════════
THÔNG TIN XÁC MINH
═══════════════════════════════════════════════════════════════

Trạng thái: ${verification.verification_status}
Ghi chú: ${verification.verification_note}
Độ tin cậy: ${verification.confidence_score}%
Facts chính: ${verification.key_facts?.join(', ') || 'N/A'}
`
    : ''
}

═══════════════════════════════════════════════════════════════
YÊU CẦU
═══════════════════════════════════════════════════════════════

1. Viết lại theo phong cách ${bot.name}
2. Độ dài: 2-4 đoạn ngắn (tối đa 200 từ)
3. Tiếng Việt tự nhiên
4. KHÔNG thêm thông tin không có trong tin gốc
5. KHÔNG mention về verification status trong nội dung

Chỉ output nội dung post, không cần tiêu đề hay metadata.
`

  const content = await chat(bot.systemPrompt, prompt, {
    maxTokens: 1024,
    temperature: 0.7, // Slightly creative for personality
  })

  // Clean up the content
  return cleanGeneratedContent(content)
}

function cleanGeneratedContent(content: string): string {
  // Remove any markdown formatting that shouldn't be in posts
  let cleaned = content
    .replace(/^#+\s+/gm, '') // Remove headers
    .replace(/\*\*/g, '') // Remove bold
    .replace(/^\s*[-*]\s+/gm, '• ') // Normalize bullet points
    .trim()

  // Ensure reasonable length
  if (cleaned.length > 1500) {
    // Truncate at last sentence before limit
    const truncated = cleaned.substring(0, 1500)
    const lastPeriod = truncated.lastIndexOf('.')
    if (lastPeriod > 1000) {
      cleaned = truncated.substring(0, lastPeriod + 1)
    }
  }

  return cleaned
}

// ═══════════════════════════════════════════════════════════════
// SAVE POST TO DATABASE
// ═══════════════════════════════════════════════════════════════

export async function saveGeneratedPost(post: GeneratedPost): Promise<{
  success: boolean
  postId?: string
  error?: string
}> {
  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('posts')
      .insert({
        bot_id: post.botId,
        content: post.content,
        verification_status: post.verificationStatus,
        verification_note: post.verificationNote,
        sources: post.sources,
        raw_news_ids: post.rawNewsIds,
      })
      .select('id')
      .single()

    if (error) throw error

    // Update bot post count
    await supabase.rpc('increment_bot_posts', { p_bot_id: post.botId })

    // Mark raw news as processed
    for (const rawNewsId of post.rawNewsIds) {
      await supabase
        .from('raw_news')
        .update({ is_processed: true, processed_at: new Date().toISOString() })
        .eq('id', rawNewsId)
    }

    return { success: true, postId: data.id }
  } catch (error) {
    console.error('Save post error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Save failed',
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// BATCH GENERATION
// ═══════════════════════════════════════════════════════════════

export async function generatePendingPosts(limit: number = 5): Promise<{
  generated: number
  results: { rawNewsId: string; postId?: string; error?: string }[]
}> {
  const supabase = getSupabaseAdmin()

  // Get unprocessed news
  const { data: unprocessedNews } = await supabase
    .from('raw_news')
    .select(
      `
      id,
      original_title,
      original_content,
      sources (name, credibility_score, category)
    `
    )
    .eq('is_processed', false)
    .order('created_at', { ascending: true })
    .limit(limit)

  const toProcess = unprocessedNews || []
  const results: { rawNewsId: string; postId?: string; error?: string }[] = []

  for (const news of toProcess) {
    // Generate post
    const { success, post, error } = await generatePostFromNews(news.id)

    if (success && post) {
      // Save to database
      const saveResult = await saveGeneratedPost(post)
      results.push({
        rawNewsId: news.id,
        postId: saveResult.postId,
        error: saveResult.error,
      })
    } else {
      results.push({
        rawNewsId: news.id,
        error,
      })
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }

  return {
    generated: results.filter((r) => r.postId).length,
    results,
  }
}
