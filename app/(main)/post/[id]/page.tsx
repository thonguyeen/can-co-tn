import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PostCard } from '@/components/feed/PostCard'
import { CommentList } from '@/components/comments'
import { formatDate } from '@/lib/utils'
import { VERIFICATION_CONFIG } from '@/lib/types'
import type { PostWithBot, PostUpdate } from '@/lib/types'

interface PostDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Get post with bot
  const { data: post, error } = await supabase
    .from('posts')
    .select(`
      *,
      bot:bots (*)
    `)
    .eq('id', id)
    .single()

  if (error || !post) {
    notFound()
  }

  // Get verification history
  const { data: updates } = await supabase
    .from('post_updates')
    .select('*')
    .eq('post_id', id)
    .order('created_at', { ascending: false })

  // Check if user has liked/saved this post
  let isLiked = false
  let isSaved = false

  if (user) {
    const [likeResult, saveResult] = await Promise.all([
      supabase.from('likes').select('*').eq('user_id', user.id).eq('post_id', id).single(),
      supabase.from('saves').select('*').eq('user_id', user.id).eq('post_id', id).single(),
    ])
    isLiked = !!likeResult.data
    isSaved = !!saveResult.data
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const postData = post as any
  const postWithBot = {
    ...postData,
    sources: postData.sources || [],
    bot: postData.bot,
  } as PostWithBot

  return (
    <div className="pb-8">
      {/* Back button */}
      <div className="mb-4">
        <Link href="/feed">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Quay lại Feed
          </Button>
        </Link>
      </div>

      {/* Post */}
      <PostCard
        post={postWithBot}
        showFullContent
        initialIsLiked={isLiked}
        initialIsSaved={isSaved}
      />

      {/* Verification History */}
      {updates && updates.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Lịch sử xác minh</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {updates.map((update: PostUpdate) => {
                const config = VERIFICATION_CONFIG[update.new_status]
                return (
                  <div
                    key={update.id}
                    className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0"
                  >
                    <div className="text-lg">{config.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {update.old_status ? (
                          <>
                            Cập nhật từ{' '}
                            <span className="text-muted-foreground">
                              {VERIFICATION_CONFIG[update.old_status].label}
                            </span>{' '}
                            sang{' '}
                            <span className={config.textColor}>
                              {config.label}
                            </span>
                          </>
                        ) : (
                          <>
                            Trạng thái ban đầu:{' '}
                            <span className={config.textColor}>
                              {config.label}
                            </span>
                          </>
                        )}
                      </p>
                      {update.note && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {update.note}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(update.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comments Section */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">
            Bình luận ({postData.comments_count})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CommentList
            postId={id}
            botName={postWithBot.bot.name}
            botAvatarUrl={postWithBot.bot.avatar_url}
            botColorAccent={postWithBot.bot.color_accent}
          />
        </CardContent>
      </Card>
    </div>
  )
}
