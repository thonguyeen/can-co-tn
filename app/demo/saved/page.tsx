'use client'

import { useState } from 'react'
import { Bookmark, Video, Image, FileText, Link2, MoreHorizontal, Search, X } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Category = 'all' | 'videos' | 'photos' | 'articles' | 'links'

const categories = [
  { id: 'all' as Category, label: 'Tất cả', icon: Bookmark },
  { id: 'videos' as Category, label: 'Video', icon: Video },
  { id: 'photos' as Category, label: 'Ảnh', icon: Image },
  { id: 'articles' as Category, label: 'Bài viết', icon: FileText },
  { id: 'links' as Category, label: 'Liên kết', icon: Link2 },
]

const savedItems = [
  { id: '1', type: 'articles' as Category, title: 'GPT-5 ra mắt với context window 1 triệu token', source: 'Minh AI', sourceColor: '#6366f1', savedTime: '2 giờ trước', description: 'Phân tích chi tiết về model mới nhất của OpenAI...' },
  { id: '2', type: 'videos' as Category, title: 'Hướng dẫn deploy Next.js lên Vercel', source: 'Tech Channel', sourceColor: '#2D6A4F', savedTime: '5 giờ trước', description: 'Video hướng dẫn step-by-step deploy ứng dụng...' },
  { id: '3', type: 'photos' as Category, title: 'Bộ sưu tập ảnh Đà Lạt mùa hoa', source: 'Travel Vietnam', sourceColor: '#40916C', savedTime: '1 ngày trước', description: '20 bức ảnh đẹp nhất về Đà Lạt mùa xuân...' },
  { id: '4', type: 'articles' as Category, title: 'VNG chuẩn bị IPO tại NASDAQ', source: 'Lan Startup', sourceColor: '#10b981', savedTime: '1 ngày trước', description: 'Phân tích chiến lược IPO của VNG và tác động...' },
  { id: '5', type: 'links' as Category, title: 'Tailwind CSS Cheat Sheet', source: 'Web Dev Tips', sourceColor: '#52B788', savedTime: '2 ngày trước', description: 'Tổng hợp các class thường dùng trong Tailwind...' },
  { id: '6', type: 'videos' as Category, title: 'Review iPhone 16 Pro Max sau 1 tháng', source: 'Nam Gadget', sourceColor: '#f59e0b', savedTime: '3 ngày trước', description: 'Đánh giá chi tiết sau thời gian sử dụng dài...' },
  { id: '7', type: 'articles' as Category, title: 'Cách tối ưu performance React app', source: 'Dev Blog', sourceColor: '#1B4D3E', savedTime: '4 ngày trước', description: 'Các kỹ thuật memo, lazy loading, code splitting...' },
  { id: '8', type: 'links' as Category, title: 'Supabase Documentation', source: 'Supabase', sourceColor: '#74C69D', savedTime: '1 tuần trước', description: 'Tài liệu chính thức của Supabase cho developers...' },
]

const iconMap: Record<Category, typeof Bookmark> = {
  all: Bookmark,
  videos: Video,
  photos: Image,
  articles: FileText,
  links: Link2,
}

export default function SavedPage() {
  const [activeCategory, setActiveCategory] = useState<Category>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [removedItems, setRemovedItems] = useState<Set<string>>(new Set())

  const filteredItems = savedItems.filter(item => {
    if (removedItems.has(item.id)) return false
    if (activeCategory !== 'all' && item.type !== activeCategory) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return item.title.toLowerCase().includes(q) || item.source.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="max-w-[900px] mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Đã lưu</h1>
      </div>

      <div className="flex gap-6">
        {/* Left - Categories */}
        <div className="w-[240px] shrink-0 hidden md:block">
          <div className="sticky top-20 space-y-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                  activeCategory === cat.id
                    ? 'bg-[#2D6A4F]/10 text-[#2D6A4F]'
                    : 'hover:bg-secondary/50 text-foreground'
                )}
              >
                <cat.icon className="w-5 h-5" />
                <span className="text-[15px] font-medium">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right - Items */}
        <div className="flex-1 min-w-0">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Tìm trong mục đã lưu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Mobile Categories */}
          <div className="flex gap-2 mb-4 overflow-x-auto md:hidden">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                  activeCategory === cat.id
                    ? 'bg-[#2D6A4F] text-white'
                    : 'bg-secondary text-foreground'
                )}
              >
                <cat.icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            ))}
          </div>

          {filteredItems.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Không có mục nào đã lưu
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const ItemIcon = iconMap[item.type]
                return (
                  <Card key={item.id} className="hover:bg-secondary/50 transition-colors">
                    <CardContent className="p-4 flex gap-4">
                      <div className="w-24 h-24 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                        <ItemIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[15px] line-clamp-1">{item.title}</p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Avatar className="w-5 h-5">
                            <AvatarFallback
                              className="text-white text-[10px]"
                              style={{ backgroundColor: item.sourceColor }}
                            >
                              {item.source[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">{item.source}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">Đã lưu {item.savedTime}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8"
                          onClick={() => setRemovedItems(prev => new Set(prev).add(item.id))}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-8 h-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
