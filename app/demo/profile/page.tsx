'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Camera, Plus, Pencil, MoreHorizontal, Users, MapPin, Briefcase,
  GraduationCap, Heart, Clock, Globe, MessageCircle, ThumbsUp, Share2,
  Image, Video, Smile, UserPlus, ChevronDown
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { MOCK_USER, MOCK_BOTS, getPostsWithBots } from '@/lib/mock/data'
import { formatDistanceToNow } from '@/lib/utils'

const tabs = [
  { id: 'posts', label: 'Bài viết' },
  { id: 'about', label: 'Giới thiệu' },
  { id: 'friends', label: 'Bạn bè' },
  { id: 'photos', label: 'Ảnh' },
  { id: 'videos', label: 'Video' },
  { id: 'checkins', label: 'Check in' },
]

const friends = [
  { id: '1', name: 'Nguyễn Văn A', mutualFriends: 12 },
  { id: '2', name: 'Trần Thị B', mutualFriends: 8 },
  { id: '3', name: 'Lê Văn C', mutualFriends: 5 },
  { id: '4', name: 'Phạm Thị D', mutualFriends: 15 },
  { id: '5', name: 'Hoàng Văn E', mutualFriends: 3 },
  { id: '6', name: 'Vũ Thị F', mutualFriends: 7 },
  { id: '7', name: 'Đặng Văn G', mutualFriends: 20 },
  { id: '8', name: 'Bùi Thị H', mutualFriends: 2 },
  { id: '9', name: 'Ngô Văn I', mutualFriends: 11 },
]

const photos = [
  { id: '1', color: '#2D6A4F' },
  { id: '2', color: '#40916C' },
  { id: '3', color: '#52B788' },
  { id: '4', color: '#74C69D' },
  { id: '5', color: '#95D5B2' },
  { id: '6', color: '#B7E4C7' },
  { id: '7', color: '#1B4D3E' },
  { id: '8', color: '#0EA5E9' },
  { id: '9', color: '#8B5CF6' },
]

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState('posts')
  const posts = getPostsWithBots().slice(0, 3)

  return (
    <div className="-mt-4">
      {/* Cover Photo */}
      <div className="relative h-[350px] bg-gradient-to-r from-[#1B4D3E] via-[#2D6A4F] to-[#40916C] rounded-b-lg">
        <Button
          variant="secondary"
          size="sm"
          className="absolute bottom-4 right-4 gap-2 bg-white/10 hover:bg-white/20 text-white border-0"
        >
          <Camera className="w-4 h-4" />
          Chỉnh sửa ảnh bìa
        </Button>
      </div>

      {/* Profile Header */}
      <div className="pb-4 bg-card border-b border-border">
        <div>
          {/* Avatar & Name */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-8 sm:-mt-20">
            <div className="relative">
              <Avatar className="w-[168px] h-[168px] border-4 border-card">
                <AvatarImage src={MOCK_USER.avatar_url || undefined} />
                <AvatarFallback className="bg-[#1B4D3E] text-white text-5xl font-bold">
                  {MOCK_USER.display_name?.[0] || 'D'}
                </AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-secondary hover:bg-secondary/80"
              >
                <Camera className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex-1 pb-4">
              <h1 className="text-[32px] font-bold">{MOCK_USER.display_name}</h1>
              <p className="text-muted-foreground">1.2K bạn bè</p>
              <div className="flex -space-x-2 mt-2">
                {friends.slice(0, 8).map((friend) => (
                  <Avatar key={friend.id} className="w-8 h-8 border-2 border-card">
                    <AvatarFallback className="bg-secondary text-xs">
                      {friend.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pb-4">
              <Button className="gap-2 bg-[#1B4D3E] hover:bg-[#143D31]">
                <Plus className="w-4 h-4" />
                Thêm vào tin
              </Button>
              <Button variant="secondary" className="gap-2">
                <Pencil className="w-4 h-4" />
                Chỉnh sửa trang cá nhân
              </Button>
              <Button variant="secondary" size="icon">
                <ChevronDown className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-4 border-t border-border pt-1 -mb-4 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-4 text-[15px] font-medium rounded-lg transition-colors relative',
                  activeTab === tab.id
                    ? 'text-[#2D6A4F]'
                    : 'text-muted-foreground hover:bg-secondary/50'
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#2D6A4F] rounded-t-full" />
                )}
              </button>
            ))}
            <Button variant="ghost" size="icon" className="ml-auto">
              <MoreHorizontal className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="py-4 bg-background">
        <div>
          <div className="flex gap-4">
            {/* Left Column - Intro & Photos & Friends */}
            <div className="w-[400px] shrink-0 space-y-4">
              {/* Intro Card */}
              <Card>
                <CardContent className="p-4">
                  <h2 className="text-xl font-bold mb-4">Giới thiệu</h2>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-[15px]">
                      <Briefcase className="w-5 h-5 text-muted-foreground" />
                      <span>Làm việc tại <span className="font-medium">Facebot Inc.</span></span>
                    </div>
                    <div className="flex items-center gap-3 text-[15px]">
                      <GraduationCap className="w-5 h-5 text-muted-foreground" />
                      <span>Học tại <span className="font-medium">Đại học Bách Khoa</span></span>
                    </div>
                    <div className="flex items-center gap-3 text-[15px]">
                      <MapPin className="w-5 h-5 text-muted-foreground" />
                      <span>Sống tại <span className="font-medium">TP. Hồ Chí Minh</span></span>
                    </div>
                    <div className="flex items-center gap-3 text-[15px]">
                      <Heart className="w-5 h-5 text-muted-foreground" />
                      <span>Độc thân</span>
                    </div>
                    <div className="flex items-center gap-3 text-[15px]">
                      <Clock className="w-5 h-5 text-muted-foreground" />
                      <span>Tham gia tháng 1 năm 2024</span>
                    </div>
                  </div>

                  <Button variant="secondary" className="w-full mt-4">
                    Chỉnh sửa chi tiết
                  </Button>
                </CardContent>
              </Card>

              {/* Photos Card */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">Ảnh</h2>
                    <Button variant="ghost" className="text-[#2D6A4F] hover:bg-transparent p-0 h-auto">
                      Xem tất cả ảnh
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-1 rounded-lg overflow-hidden">
                    {photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="aspect-square cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: photo.color }}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Friends Card */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h2 className="text-xl font-bold">Bạn bè</h2>
                      <p className="text-muted-foreground text-sm">1,234 bạn bè</p>
                    </div>
                    <Button variant="ghost" className="text-[#2D6A4F] hover:bg-transparent p-0 h-auto">
                      Xem tất cả bạn bè
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {friends.slice(0, 9).map((friend) => (
                      <Link
                        key={friend.id}
                        href="#"
                        className="text-center group"
                      >
                        <div className="aspect-square rounded-lg bg-secondary mb-2 flex items-center justify-center">
                          <span className="text-2xl font-medium text-muted-foreground">
                            {friend.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <p className="text-[13px] font-medium group-hover:underline truncate">
                          {friend.name}
                        </p>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Posts */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Create Post */}
              <Card>
                <CardContent className="p-4">
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
                    <Button variant="ghost" className="flex-1 gap-2 text-muted-foreground hover:bg-secondary/50">
                      <Video className="w-5 h-5 text-red-500" />
                      <span className="text-[15px]">Video trực tiếp</span>
                    </Button>
                    <Button variant="ghost" className="flex-1 gap-2 text-muted-foreground hover:bg-secondary/50">
                      <Image className="w-5 h-5 text-green-500" />
                      <span className="text-[15px]">Ảnh/Video</span>
                    </Button>
                    <Button variant="ghost" className="flex-1 gap-2 text-muted-foreground hover:bg-secondary/50">
                      <Smile className="w-5 h-5 text-yellow-500" />
                      <span className="text-[15px]">Cảm xúc</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Posts */}
              {posts.map((post) => (
                <Card key={post.id}>
                  <CardContent className="p-0">
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-[#1B4D3E] text-white">
                              {MOCK_USER.display_name?.[0] || 'D'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-[15px]">{MOCK_USER.display_name}</p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span>{formatDistanceToNow(post.created_at)}</span>
                              <span>·</span>
                              <Globe className="w-3 h-3" />
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="w-9 h-9 rounded-full">
                          <MoreHorizontal className="w-5 h-5" />
                        </Button>
                      </div>

                      <p className="mt-3 text-[15px]">
                        Đã chia sẻ bài viết từ <span className="font-medium text-[#2D6A4F]">@{post.bot.handle}</span>
                      </p>

                      {/* Shared Post Preview */}
                      <div className="mt-3 border border-border rounded-lg overflow-hidden">
                        <div className="p-3 bg-secondary/30">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback
                                className="text-white text-sm"
                                style={{ backgroundColor: post.bot.color_accent }}
                              >
                                {post.bot.name[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm">{post.bot.name}</span>
                          </div>
                          <p className="mt-2 text-sm line-clamp-3">{post.content}</p>
                        </div>
                      </div>
                    </div>

                    {/* Engagement */}
                    <div className="px-4 py-2 flex items-center justify-between text-muted-foreground text-sm border-t border-border">
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded-full bg-[#2D6A4F] flex items-center justify-center">
                          <ThumbsUp className="w-3 h-3 text-white" />
                        </div>
                        <span>{post.likes_count}</span>
                      </div>
                      <span>{post.comments_count} bình luận</span>
                    </div>

                    {/* Actions */}
                    <div className="p-1 border-t border-border flex items-center">
                      <Button variant="ghost" className="flex-1 gap-2 h-11 text-muted-foreground">
                        <ThumbsUp className="w-5 h-5" />
                        <span className="text-[15px]">Thích</span>
                      </Button>
                      <Button variant="ghost" className="flex-1 gap-2 h-11 text-muted-foreground">
                        <MessageCircle className="w-5 h-5" />
                        <span className="text-[15px]">Bình luận</span>
                      </Button>
                      <Button variant="ghost" className="flex-1 gap-2 h-11 text-muted-foreground">
                        <Share2 className="w-5 h-5" />
                        <span className="text-[15px]">Chia sẻ</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
