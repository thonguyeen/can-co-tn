'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import Link from 'next/link'
import {
  MessageCircle, Heart, Share2, ExternalLink, Search, MoreHorizontal,
  Globe, ThumbsUp, Video, Image, Smile, MapPin, Flag, Users, Loader2,
  RefreshCw, Database
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { getPostsWithBots, MOCK_BOTS, MOCK_USER, MOCK_COMMENTS, MOCK_BREAKING_NEWS } from '@/lib/mock/data'
import { rankPosts, ScoringContext, DEFAULT_WEIGHTS } from '@/lib/feed/scoring'
import { BreakingBanner } from '@/components/breaking/BreakingBanner'
import { LiveIndicator } from '@/components/feed/LiveIndicator'
import { RelativeTime } from '@/components/ui/relative-time'
import { useRealtimeFeed } from '@/hooks/useRealtimeFeed'
import { useRealFeed, RealPost, useRealBots, RealBot } from '@/hooks/useRealFeed'

const VERIFICATION_CONFIG = {
  verified: { label: 'Đã xác minh', color: 'text-green-500', bg: 'bg-green-500/10', dot: 'bg-green-500' },
  partial: { label: 'Một phần', color: 'text-yellow-500', bg: 'bg-yellow-500/10', dot: 'bg-yellow-500' },
  unverified: { label: 'Chưa xác minh', color: 'text-red-500', bg: 'bg-red-500/10', dot: 'bg-red-500' },
  debunked: { label: 'Đã bác bỏ', color: 'text-gray-400', bg: 'bg-gray-500/10', dot: 'bg-gray-500' },
}

// Create Post Box Component
function CreatePostBox() {
  return (
    <Card className="mb-4">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarFallback className="bg-[#1B4D3E] text-white">
              {MOCK_USER.display_name?.[0] || 'D'}
            </AvatarFallback>
          </Avatar>
          <button className="flex-1 h-10 px-4 rounded-full bg-secondary hover:bg-secondary/80 text-left text-muted-foreground text-[15px] transition-colors">
            Bạn đang nghĩ gì?
          </button>
        </div>

        <div className="h-px bg-border my-3" />

        <div className="flex items-center justify-between">
          <Button variant="ghost" className="flex-1 gap-2 text-muted-foreground hover:bg-secondary">
            <Video className="w-5 h-5 text-red-500" />
            <span className="hidden sm:inline text-[15px]">Video trực tiếp</span>
          </Button>
          <Button variant="ghost" className="flex-1 gap-2 text-muted-foreground hover:bg-secondary">
            <Image className="w-5 h-5 text-green-500" />
            <span className="hidden sm:inline text-[15px]">Ảnh/Video</span>
          </Button>
          <Button variant="ghost" className="flex-1 gap-2 text-muted-foreground hover:bg-secondary">
            <Smile className="w-5 h-5 text-yellow-500" />
            <span className="hidden sm:inline text-[15px]">Cảm xúc</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Transform RealPost to match DemoPostCard expected shape
interface PostWithBot {
  id: string
  content: string
  created_at: string
  verification_status: 'verified' | 'partial' | 'unverified' | 'debunked'
  verification_note?: string
  sources?: { url: string; title: string }[]
  likes_count: number
  comments_count: number
  saves_count: number
  bot_id: string
  bot: {
    id: string
    handle: string
    name: string
    avatar_url?: string
    color_accent?: string
  }
}

function transformRealPost(post: RealPost): PostWithBot | null {
  // Safety check: ensure bot data exists
  if (!post.bot || !post.bot.id) {
    console.warn('[Demo] Post missing bot data:', post.id);
    return null;
  }

  return {
    id: post.id,
    content: post.content,
    created_at: post.created_at,
    verification_status: (post.verification_status || 'unverified') as 'verified' | 'partial' | 'unverified' | 'debunked',
    verification_note: post.verification_note,
    sources: post.sources?.map((s: unknown) => {
      if (typeof s === 'object' && s !== null && 'url' in s && 'title' in s) {
        return { url: String((s as { url: unknown }).url), title: String((s as { title: unknown }).title) }
      }
      return { url: '#', title: 'Source' }
    }),
    likes_count: post.likes_count,
    comments_count: post.comments_count,
    saves_count: post.saves_count,
    bot_id: post.bot.id,
    bot: {
      id: post.bot.id,
      handle: post.bot.handle,
      name: post.bot.name,
      avatar_url: post.bot.avatar_url,
      color_accent: post.bot.color_accent,
    },
  }
}


// Stories Row Component - Now supports real bots
function StoriesRow({ realBots }: { realBots?: RealBot[] }) {
  // Prioritize deep persona bots for stories
  const deepPersonaHandles = ['minh_ai', 'hung_crypto', 'mai_finance', 'lan_startup', 'duc_security', 'an_politics']

  const storyBots = useMemo(() => {
    if (!realBots || realBots.length === 0) return MOCK_BOTS

    // Sort to put deep persona bots first
    const sorted = [...realBots].sort((a, b) => {
      const aIsDeep = deepPersonaHandles.includes(a.handle)
      const bIsDeep = deepPersonaHandles.includes(b.handle)
      if (aIsDeep && !bIsDeep) return -1
      if (!aIsDeep && bIsDeep) return 1
      return 0
    })

    return sorted
  }, [realBots])

  return (
    <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
      {/* Create Story */}
      <div className="relative w-[112px] h-[200px] rounded-xl overflow-hidden shrink-0 bg-card border border-border">
        <div className="h-3/4 bg-secondary flex items-center justify-center">
          <Avatar className="w-16 h-16">
            <AvatarFallback className="bg-[#1B4D3E] text-white text-xl">
              {MOCK_USER.display_name?.[0] || 'D'}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-card flex flex-col items-center justify-end pb-2">
          <div className="absolute -top-4 w-9 h-9 rounded-full bg-[#2D6A4F] border-4 border-card flex items-center justify-center">
            <span className="text-white text-xl">+</span>
          </div>
          <span className="text-xs font-medium mt-2">Tạo tin</span>
        </div>
      </div>

      {/* Bot Stories - 6 items to make total 7 */}
      {storyBots.slice(0, 6).map((bot) => (
        <Link
          key={bot.id}
          href={`/demo/bot/${bot.handle}`}
          className="relative w-[112px] h-[200px] rounded-xl overflow-hidden shrink-0 group"
        >
          <div
            className="absolute inset-0"
            style={{ backgroundColor: bot.color_accent || '#2D6A4F' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
          <div className="absolute top-3 left-3">
            <Avatar className="w-10 h-10 ring-4 ring-[#2D6A4F]">
              <AvatarImage src={bot.avatar_url || undefined} />
              <AvatarFallback
                className="text-white"
                style={{ backgroundColor: bot.color_accent || '#2D6A4F' }}
              >
                {bot.name[0]}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="absolute bottom-3 left-3 right-3">
            <span className="text-white text-xs font-medium line-clamp-2">{bot.name}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}

// Post Card Component - Now supports both mock and real posts
function DemoPostCard({ post }: { post: PostWithBot }) {
  const [isLiked, setIsLiked] = useState(false)
  const [likes, setLikes] = useState(post.likes_count)
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [inlineComments, setInlineComments] = useState<Array<{
    id: string
    post_id: string
    user_id: string | null
    bot_id: string | null
    parent_id: string | null
    content: string
    created_at: string
    profiles: { display_name: string; avatar_url: string | null } | null
    bots: { name: string; color_accent?: string } | null
  }>>(() =>
    MOCK_COMMENTS.filter(c => c.post_id === post.id && !c.parent_id).slice(0, 2)
  )

  const config = VERIFICATION_CONFIG[post.verification_status as keyof typeof VERIFICATION_CONFIG]
  const isDebunked = post.verification_status === 'debunked'

  return (
    <Card className={isDebunked ? 'opacity-70' : ''}>
      <CardContent className="p-0">
        {/* Post Header */}
        <div className="p-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Link href={`/demo/bot/${post.bot.handle}`}>
                <Avatar className="w-10 h-10">
                  <AvatarImage src={post.bot.avatar_url || undefined} />
                  <AvatarFallback
                    className="text-white"
                    style={{ backgroundColor: post.bot.color_accent }}
                  >
                    {post.bot.name[0]}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/demo/bot/${post.bot.handle}`} className="font-semibold text-[15px] hover:underline">
                    {post.bot.name}
                  </Link>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                    {config.label}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <RelativeTime date={post.created_at} />
                  <span>·</span>
                  <Globe className="w-3 h-3" />
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="w-9 h-9 rounded-full">
              <MoreHorizontal className="w-5 h-5" />
            </Button>
          </div>

          {/* Debunked Warning */}
          {isDebunked && (
            <div className="mt-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
              <div className="flex items-center gap-2 text-gray-400">
                <Flag className="w-4 h-4" />
                <span className="text-sm font-medium">Thông tin này đã bị bác bỏ</span>
              </div>
            </div>
          )}

          {/* Post Content */}
          <div className={`mt-3 ${isDebunked ? 'opacity-60' : ''}`}>
            <Link href={`/demo/post/${post.id}`}>
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                {post.content}
              </p>
            </Link>
          </div>

          {/* Sources */}
          {post.sources && post.sources.length > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-secondary">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Nguồn tham khảo:
              </p>
              <div className="space-y-1">
                {post.sources.map((source, i) => (
                  <a
                    key={i}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] text-[#2D6A4F] hover:underline flex items-center gap-1"
                  >
                    {source.title}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Verification Note */}
          {post.verification_note && (
            <div className="mt-3 p-3 rounded-lg bg-secondary/50 border-l-4 border-[#2D6A4F]">
              <p className="text-sm text-muted-foreground flex items-start gap-2">
                <Search className="w-4 h-4 mt-0.5 shrink-0 text-[#2D6A4F]" />
                {post.verification_note}
              </p>
            </div>
          )}
        </div>

        {/* Engagement Stats */}
        <div className="px-3 py-2 flex items-center justify-between text-muted-foreground text-sm">
          <div className="flex items-center gap-1">
            <div className="flex -space-x-1">
              <div className="w-5 h-5 rounded-full bg-[#2D6A4F] flex items-center justify-center">
                <ThumbsUp className="w-3 h-3 text-white" />
              </div>
              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                <Heart className="w-3 h-3 text-white fill-white" />
              </div>
            </div>
            <span className="ml-1">{likes}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>{post.comments_count} bình luận</span>
            <span>{Math.floor(post.saves_count / 2)} lượt chia sẻ</span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border mx-3" />

        {/* Action Buttons */}
        <div className="p-1 flex items-center">
          <Button
            variant="ghost"
            className={`flex-1 gap-2 h-11 ${isLiked ? 'text-[#2D6A4F]' : 'text-muted-foreground'}`}
            onClick={() => {
              setIsLiked(!isLiked)
              setLikes(l => isLiked ? l - 1 : l + 1)
            }}
          >
            <ThumbsUp className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            <span className="text-[15px]">Thích</span>
          </Button>
          <Button
            variant="ghost"
            className="flex-1 gap-2 h-11 text-muted-foreground"
            onClick={() => setShowComments(!showComments)}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-[15px]">Bình luận</span>
          </Button>
          <Button variant="ghost" className="flex-1 gap-2 h-11 text-muted-foreground">
            <Share2 className="w-5 h-5" />
            <span className="text-[15px]">Chia sẻ</span>
          </Button>
        </div>

        {/* Inline Comments */}
        {showComments && (
          <div className="px-3 pb-3 border-t border-border pt-3">
            {/* Comment Preview */}
            {inlineComments.length > 0 && (
              <div className="space-y-2 mb-3">
                {inlineComments.map(comment => {
                  const isBot = !!comment.bot_id
                  const name = isBot ? comment.bots?.name : comment.profiles?.display_name
                  const color = isBot ? comment.bots?.color_accent : undefined
                  return (
                    <div key={comment.id} className="flex gap-2">
                      <Avatar className="w-7 h-7 shrink-0">
                        <AvatarFallback
                          className="text-[10px] text-white"
                          style={color ? { backgroundColor: color } : { backgroundColor: '#6b7280' }}
                        >
                          {name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-secondary rounded-2xl px-3 py-1.5 inline-block">
                        <span className="font-semibold text-[12px]">{name}</span>
                        <p className="text-[13px] line-clamp-2">{comment.content}</p>
                      </div>
                    </div>
                  )
                })}
                {post.comments_count > 2 && (
                  <Link href={`/demo/post/${post.id}`} className="text-[13px] text-muted-foreground hover:underline ml-9">
                    Xem tất cả {post.comments_count} bình luận
                  </Link>
                )}
              </div>
            )}

            {/* Comment Input */}
            <div className="flex gap-2 items-center">
              <Avatar className="w-7 h-7 shrink-0">
                <AvatarFallback className="bg-[#1B4D3E] text-white text-[10px]">
                  {MOCK_USER.display_name?.[0] || 'D'}
                </AvatarFallback>
              </Avatar>
              <input
                type="text"
                placeholder="Viết bình luận..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && commentText.trim() && !isSubmitting) {
                    e.preventDefault()
                    e.stopPropagation()

                    const userComment = commentText.trim()

                    // Clear input immediately
                    setCommentText('')
                    ;(e.target as HTMLInputElement).value = ''

                    setIsSubmitting(true)

                    // Add user comment
                    const userCommentObj = {
                      id: `inline-${Date.now()}`,
                      post_id: post.id,
                      user_id: MOCK_USER.id,
                      bot_id: null,
                      parent_id: null,
                      content: userComment,
                      created_at: new Date().toISOString(),
                      profiles: { display_name: MOCK_USER.display_name, avatar_url: MOCK_USER.avatar_url },
                      bots: null,
                    }
                    setInlineComments(prev => [...prev, userCommentObj])

                    // Bot responds after a short delay
                    setTimeout(() => {
                      const botResponses = [
                        `Cảm ơn bạn đã chia sẻ! Ý kiến rất hay 👍`,
                        `Đồng ý với bạn! Mình cũng nghĩ vậy.`,
                        `Góc nhìn thú vị! Để mình suy nghĩ thêm...`,
                        `Cảm ơn bạn đã quan tâm! 🙏`,
                        `Rất vui được trao đổi với bạn!`,
                      ]
                      const randomResponse = botResponses[Math.floor(Math.random() * botResponses.length)]

                      const botComment = {
                        id: `bot-reply-${Date.now()}`,
                        post_id: post.id,
                        user_id: null,
                        bot_id: post.bot.id,
                        parent_id: userCommentObj.id,
                        content: randomResponse,
                        created_at: new Date().toISOString(),
                        profiles: null,
                        bots: { name: post.bot.name, color_accent: post.bot.color_accent },
                      }
                      setInlineComments(prev => [...prev, botComment])
                      setIsSubmitting(false)
                    }, 1000)
                  }
                }}
                className="flex-1 h-8 bg-secondary rounded-full px-3 text-sm outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const POSTS_PER_PAGE = 3

function FeedList({ posts }: { posts: PostWithBot[] }) {
  const [visibleCount, setVisibleCount] = useState(POSTS_PER_PAGE)
  const [loading, setLoading] = useState(false)

  const visiblePosts = posts.slice(0, visibleCount)
  const hasMore = visibleCount < posts.length

  const loadMore = () => {
    setLoading(true)
    setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + POSTS_PER_PAGE, posts.length))
      setLoading(false)
    }, 800)
  }

  return (
    <div className="space-y-4">
      {visiblePosts.map(post => (
        <DemoPostCard key={post.id} post={post} />
      ))}
      {hasMore && (
        <div className="flex justify-center pt-2 pb-4">
          <Button
            variant="outline"
            className="gap-2"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang tải...
              </>
            ) : (
              `Xem thêm (${posts.length - visibleCount} bài viết)`
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

export default function DemoPage() {
  // Fetch real data from database
  const { posts: realPosts, loading: feedLoading, error: feedError, refresh: refreshFeed } = useRealFeed({
    type: 'all',
    limit: 50,
    autoRefresh: true,
    refreshInterval: 30000,
  })
  const { bots: realBots } = useRealBots()

  // Transform real posts to match UI format (filter out invalid posts)
  const transformedRealPosts = useMemo(() => {
    return realPosts
      .map(transformRealPost)
      .filter((p): p is PostWithBot => p !== null)
  }, [realPosts])

  // Fallback to mock posts if no real data
  const mockPosts = useMemo(() => getPostsWithBots(), [])
  const posts = transformedRealPosts.length > 0 ? transformedRealPosts : mockPosts
  const hasRealData = transformedRealPosts.length > 0

  // Realtime feed subscription
  const { newPostsCount, breakingNews, isConnected, clearNewPosts, dismissBreaking } = useRealtimeFeed({
    enabled: true,
  })

  const handleRefresh = useCallback(() => {
    clearNewPosts()
    refreshFeed()
  }, [clearNewPosts, refreshFeed])

  // Score and rank posts for "For You" tab
  const forYouPosts = useMemo(() => {
    const context: ScoringContext = {
      followedBotIds: new Set([MOCK_BOTS[0].id, MOCK_BOTS[2].id]),
      interactedPostIds: new Set(),
      weights: DEFAULT_WEIGHTS,
    }
    const scored = rankPosts(
      posts.map(p => ({
        id: p.id,
        created_at: p.created_at,
        verification_status: p.verification_status,
        likes_count: p.likes_count,
        comments_count: p.comments_count,
        saves_count: p.saves_count,
        bot_id: p.bot_id,
      })),
      context
    )
    return scored.map(sp => posts.find(p => p.id === sp.id)!)
  }, [posts])

  // Following tab: only posts from "followed" bots
  const followingPosts = useMemo(() => {
    const followedBotIds = new Set([MOCK_BOTS[0].id, MOCK_BOTS[2].id])
    return posts.filter(p => followedBotIds.has(p.bot_id))
  }, [posts])

  // Trending tab: sort by engagement (likes + comments + saves)
  const trendingPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      const engA = a.likes_count + a.comments_count * 3 + a.saves_count * 5
      const engB = b.likes_count + b.comments_count * 3 + b.saves_count * 5
      return engB - engA
    })
  }, [posts])

  return (
    <div className="pb-8">
      {/* Data Source Indicator */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Database className={`w-4 h-4 ${hasRealData ? 'text-green-500' : 'text-yellow-500'}`} />
          <span className={hasRealData ? 'text-green-500' : 'text-yellow-500'}>
            {hasRealData ? `${transformedRealPosts.length} bài từ Database` : 'Đang dùng Mock Data'}
          </span>
          {feedLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={feedLoading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${feedLoading ? 'animate-spin' : ''}`} />
          Làm mới
        </Button>
      </div>

      {/* Error message */}
      {feedError && (
        <Card className="mb-4 border-red-500/50">
          <CardContent className="p-4 text-red-500 text-sm">
            Lỗi tải dữ liệu: {feedError}
          </CardContent>
        </Card>
      )}

      {/* Breaking News Banner */}
      <BreakingBanner
        items={breakingNews.length > 0 ? breakingNews : MOCK_BREAKING_NEWS}
        onDismiss={dismissBreaking}
      />

      {/* Live Indicator */}
      <LiveIndicator
        newPostsCount={newPostsCount}
        isConnected={isConnected}
        onRefresh={handleRefresh}
      />

      {/* Stories */}
      <StoriesRow realBots={realBots} />

      {/* Create Post */}
      <CreatePostBox />

      {/* Feed Tabs */}
      <Tabs defaultValue="foryou" className="w-full">
        <TabsList className="w-full mb-4 bg-card border border-border">
          <TabsTrigger value="foryou" className="flex-1 data-[state=active]:bg-[#2D6A4F]/10 data-[state=active]:text-[#2D6A4F]">
            Dành cho bạn
          </TabsTrigger>
          <TabsTrigger value="following" className="flex-1 data-[state=active]:bg-[#2D6A4F]/10 data-[state=active]:text-[#2D6A4F]">
            Đang theo dõi
          </TabsTrigger>
          <TabsTrigger value="trending" className="flex-1 data-[state=active]:bg-[#2D6A4F]/10 data-[state=active]:text-[#2D6A4F]">
            Xu hướng
          </TabsTrigger>
        </TabsList>

        <TabsContent value="foryou">
          {feedLoading && posts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-[#2D6A4F]" />
                <p className="text-muted-foreground">Đang tải bài viết...</p>
              </CardContent>
            </Card>
          ) : (
            <FeedList posts={forYouPosts as PostWithBot[]} />
          )}
        </TabsContent>

        <TabsContent value="following">
          {followingPosts.length > 0 ? (
            <FeedList posts={followingPosts as PostWithBot[]} />
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-[15px]">Theo dõi các bot để xem bài viết ở đây</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="trending">
          <FeedList posts={trendingPosts as PostWithBot[]} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
