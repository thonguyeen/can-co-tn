'use client'

import { useState } from 'react'
import { Bell, ThumbsUp, MessageCircle, UserPlus, Share2, AtSign, MoreHorizontal, Check } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Tab = 'all' | 'unread'

interface Notification {
  id: string
  type: 'like' | 'comment' | 'friend_request' | 'share' | 'mention' | 'group'
  actor: string
  actorColor: string
  content: string
  time: string
  read: boolean
  actionable?: boolean
}

const initialNotifications: Notification[] = [
  { id: '1', type: 'like', actor: 'Nguyễn Minh Tuấn', actorColor: '#2D6A4F', content: 'đã thích bài viết của bạn', time: '5 phút trước', read: false },
  { id: '2', type: 'comment', actor: 'Trần Thị Hương', actorColor: '#1B4D3E', content: 'đã bình luận về bài viết của bạn: "Hay quá! Cảm ơn bạn đã chia sẻ"', time: '15 phút trước', read: false },
  { id: '3', type: 'friend_request', actor: 'Lưu Quang Minh', actorColor: '#40916C', content: 'đã gửi cho bạn lời mời kết bạn', time: '30 phút trước', read: false, actionable: true },
  { id: '4', type: 'share', actor: 'Lê Hoàng Nam', actorColor: '#52B788', content: 'đã chia sẻ bài viết của bạn', time: '1 giờ trước', read: true },
  { id: '5', type: 'mention', actor: 'Phạm Thị Mai', actorColor: '#74C69D', content: 'đã nhắc đến bạn trong một bình luận', time: '2 giờ trước', read: true },
  { id: '6', type: 'like', actor: 'Hoàng Đức Anh', actorColor: '#2D6A4F', content: 'và 5 người khác đã thích bài viết của bạn', time: '3 giờ trước', read: true },
  { id: '7', type: 'group', actor: 'AI News Vietnam', actorColor: '#1B4D3E', content: 'có 3 bài viết mới hôm nay', time: '4 giờ trước', read: true },
  { id: '8', type: 'comment', actor: 'Vũ Thị Lan', actorColor: '#40916C', content: 'đã trả lời bình luận của bạn: "Đồng ý với quan điểm này!"', time: '5 giờ trước', read: true },
  { id: '9', type: 'friend_request', actor: 'Cao Văn Đạt', actorColor: '#52B788', content: 'đã chấp nhận lời mời kết bạn của bạn', time: '6 giờ trước', read: true },
  { id: '10', type: 'like', actor: 'Đặng Quốc Bảo', actorColor: '#74C69D', content: 'đã thích ảnh của bạn', time: '1 ngày trước', read: true },
  { id: '11', type: 'mention', actor: 'Bùi Thị Ngọc', actorColor: '#2D6A4F', content: 'đã nhắc đến bạn trong bài viết tại nhóm Tech Enthusiasts', time: '1 ngày trước', read: true },
  { id: '12', type: 'share', actor: 'Ngô Thanh Tùng', actorColor: '#1B4D3E', content: 'đã chia sẻ bài viết của bạn với bình luận', time: '2 ngày trước', read: true },
]

const iconMap = {
  like: ThumbsUp,
  comment: MessageCircle,
  friend_request: UserPlus,
  share: Share2,
  mention: AtSign,
  group: Bell,
}

const iconColorMap = {
  like: 'bg-blue-500',
  comment: 'bg-green-500',
  friend_request: 'bg-[#2D6A4F]',
  share: 'bg-orange-500',
  mention: 'bg-purple-500',
  group: 'bg-red-500',
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [notifications, setNotifications] = useState(initialNotifications)

  const unreadCount = notifications.filter(n => !n.read).length
  const displayedNotifications = activeTab === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  return (
    <div className="max-w-[700px] mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Thông báo</h1>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="text-[#2D6A4F] gap-1" onClick={markAllAsRead}>
            <Check className="w-4 h-4" />
            Đánh dấu tất cả đã đọc
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setActiveTab('all')}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium transition-colors',
            activeTab === 'all' ? 'bg-[#2D6A4F] text-white' : 'bg-secondary hover:bg-secondary/80'
          )}
        >
          Tất cả
        </button>
        <button
          onClick={() => setActiveTab('unread')}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium transition-colors',
            activeTab === 'unread' ? 'bg-[#2D6A4F] text-white' : 'bg-secondary hover:bg-secondary/80'
          )}
        >
          Chưa đọc
          {unreadCount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-white/20">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notifications List */}
      {displayedNotifications.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
            <p>Không có thông báo nào</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {displayedNotifications.map((notification) => {
            const Icon = iconMap[notification.type]
            return (
              <div
                key={notification.id}
                onClick={() => markAsRead(notification.id)}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                  notification.read ? 'hover:bg-secondary/50' : 'bg-[#2D6A4F]/5 hover:bg-[#2D6A4F]/10'
                )}
              >
                <div className="relative shrink-0">
                  <Avatar className="w-14 h-14">
                    <AvatarFallback className="text-white font-bold text-lg" style={{ backgroundColor: notification.actorColor }}>
                      {notification.actor.split(' ').slice(-1)[0][0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn('absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center', iconColorMap[notification.type])}>
                    <Icon className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[15px]">
                    <span className="font-semibold">{notification.actor}</span>{' '}
                    <span className="text-muted-foreground">{notification.content}</span>
                  </p>
                  <p className={cn('text-sm mt-0.5', notification.read ? 'text-muted-foreground' : 'text-[#2D6A4F] font-medium')}>
                    {notification.time}
                  </p>

                  {notification.actionable && !notification.read && (
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="bg-[#2D6A4F] hover:bg-[#1B4D3E]">
                        Xác nhận
                      </Button>
                      <Button size="sm" variant="secondary">
                        Xoá
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!notification.read && (
                    <div className="w-3 h-3 rounded-full bg-[#2D6A4F]" />
                  )}
                  <Button variant="ghost" size="icon" className="w-8 h-8">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
