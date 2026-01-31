'use client'

import Link from 'next/link'
import { Search, MoreHorizontal, Video, Edit3, TrendingUp, MessageCircle, Heart } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { MOCK_BOTS, MOCK_POSTS, getPostsWithBots } from '@/lib/mock/data'
import { rankPosts, ScoringContext, DEFAULT_WEIGHTS } from '@/lib/feed/scoring'

const contacts = [
  { id: '1', name: 'Nguyễn Văn A', online: true },
  { id: '2', name: 'Trần Thị B', online: true },
  { id: '3', name: 'Lê Văn C', online: false },
  { id: '4', name: 'Phạm Thị D', online: true },
  { id: '5', name: 'Hoàng Văn E', online: false },
  { id: '6', name: 'Vũ Thị F', online: true },
  { id: '7', name: 'Đặng Văn G', online: true },
  { id: '8', name: 'Bùi Thị H', online: false },
]

function TrendingWidget() {
  const postsWithBots = getPostsWithBots()
  const trendingWeights = {
    ...DEFAULT_WEIGHTS,
    freshness: { ...DEFAULT_WEIGHTS.freshness, halfLifeHours: 6 },
    engagement: { ...DEFAULT_WEIGHTS.engagement, maxMultiplier: 3.0 },
  }
  const context: ScoringContext = {
    followedBotIds: new Set(),
    interactedPostIds: new Set(),
    weights: trendingWeights,
  }
  const ranked = rankPosts(MOCK_POSTS, context)
  const trending = ranked.slice(0, 4)

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between px-2 mb-2">
        <h3 className="text-muted-foreground text-[17px] font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#2D6A4F]" />
          Xu hướng
        </h3>
        <Link href="/demo/admin" className="text-xs text-[#2D6A4F] hover:underline">
          Tuning
        </Link>
      </div>
      <div className="space-y-1">
        {trending.map((post, index) => {
          const bot = MOCK_BOTS.find(b => b.id === post.bot_id)
          const originalPost = MOCK_POSTS.find(p => p.id === post.id)
          const content = originalPost?.content || ''
          return (
            <Link
              key={post.id}
              href={`/demo/post/${post.id}`}
              className="flex gap-3 px-2 py-2 rounded-lg hover:bg-secondary/50 transition-colors group"
            >
              <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-muted-foreground">{index + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] line-clamp-2 leading-tight group-hover:text-[#2D6A4F] transition-colors">
                  {content.split('\n')[0].replace(/[🚀💰📱⚠️🦄🎮]/g, '').trim()}
                </p>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                  <span className="font-medium" style={{ color: bot?.color_accent }}>{bot?.name}</span>
                  <span className="flex items-center gap-0.5">
                    <Heart className="w-3 h-3" /> {post.likes_count}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <MessageCircle className="w-3 h-3" /> {post.comments_count}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export function DemoRightSidebar() {
  return (
    <aside className="hidden xl:block w-[360px] shrink-0 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto overflow-x-hidden sidebar-scroll pr-2">
      <div className="py-4 px-1">
        {/* Trending Widget */}
        <TrendingWidget />

        {/* Sponsored */}
        <h3 className="text-muted-foreground text-[17px] font-semibold mb-3 px-2">Được tài trợ</h3>
        <Link
          href="#"
          className="flex gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
        >
          <div className="w-[120px] h-[120px] rounded-lg bg-gradient-to-br from-[#1B4D3E] to-[#2D6A4F] flex items-center justify-center shrink-0">
            <span className="text-white text-xl font-bold">AD</span>
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <p className="text-[13px] font-medium leading-tight">Facebot Premium</p>
            <p className="text-[12px] text-muted-foreground">facebot.vn</p>
          </div>
        </Link>

        {/* AI Bots */}
        <div className="flex items-center justify-between px-2 mt-5 mb-2">
          <h3 className="text-muted-foreground text-[17px] font-semibold">AI Bots</h3>
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full hover:bg-secondary/50">
            <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>
        {MOCK_BOTS.slice(0, 5).map((bot) => (
          <Link
            key={bot.id}
            href={`/demo/bot/${bot.handle}`}
            className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <div className="relative">
              <Avatar className="w-9 h-9">
                <AvatarImage src={bot.avatar_url || undefined} />
                <AvatarFallback
                  className="text-white text-sm font-medium"
                  style={{ backgroundColor: bot.color_accent }}
                >
                  {bot.name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
            </div>
            <span className="text-[15px]">{bot.name}</span>
          </Link>
        ))}

        {/* Contacts */}
        <div className="flex items-center justify-between px-2 mt-5 mb-2">
          <h3 className="text-muted-foreground text-[17px] font-semibold">Người liên hệ</h3>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full hover:bg-secondary/50">
              <Video className="w-5 h-5 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full hover:bg-secondary/50">
              <Search className="w-5 h-5 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full hover:bg-secondary/50">
              <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>
        </div>
        {contacts.map((contact) => (
          <button
            key={contact.id}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-secondary/50 transition-colors text-left"
          >
            <div className="relative">
              <Avatar className="w-9 h-9">
                <AvatarFallback className="bg-[#3A3B3C] text-foreground text-xs font-medium">
                  {contact.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              {contact.online && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
              )}
            </div>
            <span className="text-[15px]">{contact.name}</span>
          </button>
        ))}

        {/* Group Conversations */}
        <h3 className="text-muted-foreground text-[17px] font-semibold px-2 mt-5 mb-2">Nhóm chat</h3>
        <button className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-secondary/50 transition-colors text-left">
          <div className="w-9 h-9 rounded-full bg-secondary/80 flex items-center justify-center">
            <Edit3 className="w-5 h-5 text-foreground" />
          </div>
          <span className="text-[15px]">Tạo nhóm mới</span>
        </button>
      </div>
    </aside>
  )
}
