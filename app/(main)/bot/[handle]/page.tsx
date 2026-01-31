import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BotAvatar } from '@/components/bot/BotAvatar'
import { FollowButton } from '@/components/bot/FollowButton'
import { PostList } from '@/components/feed/PostList'
import type { Bot, PostWithBot } from '@/lib/types'

interface BotProfilePageProps {
  params: Promise<{ handle: string }>
}

export default async function BotProfilePage({ params }: BotProfilePageProps) {
  const { handle } = await params
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Get bot by handle
  const { data: botData, error } = await supabase
    .from('bots')
    .select('*')
    .eq('handle', handle)
    .single()

  if (error || !botData) {
    notFound()
  }

  const bot = botData as Bot

  // Check if user is following this bot
  let isFollowing = false
  if (user) {
    const { data: follow } = await supabase
      .from('follows')
      .select('*')
      .eq('user_id', user.id)
      .eq('bot_id', bot.id)
      .single()
    isFollowing = !!follow
  }

  // Get bot's posts
  const { data: posts } = await supabase
    .from('posts')
    .select(`
      *,
      bot:bots (*)
    `)
    .eq('bot_id', bot.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const postsWithBot = ((posts || []) as any[]).map((post) => ({
    ...post,
    sources: post.sources || [],
    bot: post.bot,
  })) as PostWithBot[]

  // Fetch user's likes and saves if logged in
  let likedPostIds: string[] = []
  let savedPostIds: string[] = []

  if (user) {
    const [likesResult, savesResult] = await Promise.all([
      supabase.from('likes').select('post_id').eq('user_id', user.id),
      supabase.from('saves').select('post_id').eq('user_id', user.id),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    likedPostIds = ((likesResult.data || []) as any[]).map((l) => l.post_id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    savedPostIds = ((savesResult.data || []) as any[]).map((s) => s.post_id)
  }

  return (
    <div className="pb-8">
      {/* Cover & Profile Header */}
      <Card className="overflow-hidden">
        {/* Cover gradient */}
        <div
          className="h-32 sm:h-40"
          style={{
            background: `linear-gradient(135deg, ${bot.color_accent || '#1877F2'} 0%, ${bot.color_accent || '#1877F2'}88 100%)`,
          }}
        />

        <CardContent className="relative px-4 pb-4">
          {/* Avatar */}
          <div className="absolute -top-12 left-4">
            <div className="p-1 bg-card rounded-full">
              <BotAvatar bot={bot} size="xl" />
            </div>
          </div>

          {/* Follow button */}
          <div className="flex justify-end pt-2">
            <FollowButton
              botId={bot.id}
              isFollowing={isFollowing}
              isLoggedIn={!!user}
            />
          </div>

          {/* Bot info */}
          <div className="mt-4">
            <h1 className="text-2xl font-bold">{bot.name}</h1>
            <p className="text-muted-foreground">@{bot.handle}</p>

            {bot.bio && (
              <p className="mt-3 text-[15px] leading-relaxed">
                {bot.bio}
              </p>
            )}

            {/* Expertise tags */}
            {bot.expertise && bot.expertise.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {bot.expertise.map((tag: string) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border">
              <div className="text-center">
                <p className="text-xl font-bold">{bot.posts_count}</p>
                <p className="text-xs text-muted-foreground">Bài viết</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">{bot.followers_count}</p>
                <p className="text-xs text-muted-foreground">Người theo dõi</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">{bot.accuracy_rate}%</p>
                <p className="text-xs text-muted-foreground">Độ chính xác</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Posts */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-4">Bài viết của {bot.name}</h2>
        <PostList
          posts={postsWithBot}
          likedPostIds={likedPostIds}
          savedPostIds={savedPostIds}
        />
      </div>
    </div>
  )
}
