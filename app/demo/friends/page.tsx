'use client'

import { useState, useMemo } from 'react'
import {
  Users, UserPlus, Search, MessageCircle, MoreHorizontal, X, Check, MapPin, Briefcase
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { MOCK_FRIENDS, MOCK_FRIEND_REQUESTS, MOCK_FRIEND_SUGGESTIONS } from '@/lib/mock/data'

type Tab = 'all' | 'requests' | 'suggestions'

export default function FriendsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [acceptedRequests, setAcceptedRequests] = useState<Set<string>>(new Set())
  const [rejectedRequests, setRejectedRequests] = useState<Set<string>>(new Set())
  const [addedSuggestions, setAddedSuggestions] = useState<Set<string>>(new Set())
  const [removedSuggestions, setRemovedSuggestions] = useState<Set<string>>(new Set())

  const tabs = [
    { id: 'all' as Tab, label: 'Tất cả bạn bè', icon: Users },
    { id: 'requests' as Tab, label: 'Lời mời kết bạn', icon: UserPlus },
    { id: 'suggestions' as Tab, label: 'Gợi ý', icon: Users },
  ]

  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return MOCK_FRIENDS
    const q = searchQuery.toLowerCase()
    return MOCK_FRIENDS.filter(
      f => f.name.toLowerCase().includes(q) || f.job.toLowerCase().includes(q) || f.location.toLowerCase().includes(q)
    )
  }, [searchQuery])

  const visibleRequests = MOCK_FRIEND_REQUESTS.filter(
    r => !acceptedRequests.has(r.id) && !rejectedRequests.has(r.id)
  )

  const visibleSuggestions = MOCK_FRIEND_SUGGESTIONS.filter(
    s => !addedSuggestions.has(s.id) && !removedSuggestions.has(s.id)
  )

  return (
    <div className="max-w-[1000px] mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Bạn bè</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-full text-[15px] font-medium transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-[#2D6A4F] text-white'
                : 'bg-secondary text-foreground hover:bg-secondary/80'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.id === 'requests' && visibleRequests.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-white/20">
                {visibleRequests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Friend Requests */}
      {activeTab === 'requests' && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Lời mời kết bạn</h2>
          {visibleRequests.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Không có lời mời kết bạn nào
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {visibleRequests.map((request) => (
                <Card key={request.id} className="overflow-hidden">
                  <CardContent className="p-4 flex gap-4">
                    <Avatar className="w-20 h-20 shrink-0">
                      <AvatarFallback
                        className="text-white text-xl font-bold"
                        style={{ backgroundColor: request.avatarColor }}
                      >
                        {request.name.split(' ').slice(-1)[0][0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[15px] truncate">{request.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {request.mutualFriends} bạn chung
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{request.time}</p>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          className="flex-1 bg-[#2D6A4F] hover:bg-[#1B4D3E] gap-1"
                          onClick={() => setAcceptedRequests(prev => new Set(prev).add(request.id))}
                        >
                          <Check className="w-4 h-4" />
                          Xác nhận
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex-1 gap-1"
                          onClick={() => setRejectedRequests(prev => new Set(prev).add(request.id))}
                        >
                          <X className="w-4 h-4" />
                          Xoá
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Suggestions */}
      {activeTab === 'suggestions' && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Những người bạn có thể biết</h2>
          {visibleSuggestions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Không có gợi ý nào
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {visibleSuggestions.map((suggestion) => (
                <Card key={suggestion.id} className="overflow-hidden">
                  <CardContent className="p-4 flex gap-4">
                    <Avatar className="w-20 h-20 shrink-0">
                      <AvatarFallback
                        className="text-white text-xl font-bold"
                        style={{ backgroundColor: suggestion.avatarColor }}
                      >
                        {suggestion.name.split(' ').slice(-1)[0][0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[15px] truncate">{suggestion.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {suggestion.mutualFriends} bạn chung
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          className="flex-1 bg-[#2D6A4F] hover:bg-[#1B4D3E] gap-1"
                          onClick={() => setAddedSuggestions(prev => new Set(prev).add(suggestion.id))}
                        >
                          <UserPlus className="w-4 h-4" />
                          Thêm bạn bè
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex-1 gap-1"
                          onClick={() => setRemovedSuggestions(prev => new Set(prev).add(suggestion.id))}
                        >
                          <X className="w-4 h-4" />
                          Xoá
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: All Friends */}
      {activeTab === 'all' && (
        <div>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm bạn bè..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            {filteredFriends.length} bạn bè
            {searchQuery && ` phù hợp với "${searchQuery}"`}
          </p>

          {filteredFriends.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Không tìm thấy bạn bè nào
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFriends.map((friend) => (
                <Card key={friend.id} className="overflow-hidden hover:bg-secondary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="w-20 h-20 shrink-0">
                        <AvatarFallback
                          className="text-white text-xl font-bold"
                          style={{ backgroundColor: friend.avatarColor }}
                        >
                          {friend.name.split(' ').slice(-1)[0][0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[15px] truncate">{friend.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {friend.mutualFriends} bạn chung
                        </p>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Briefcase className="w-3 h-3" />
                          <span className="truncate">{friend.job}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          <span>{friend.location}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="secondary" className="flex-1 gap-1">
                        <MessageCircle className="w-4 h-4" />
                        Nhắn tin
                      </Button>
                      <Button size="sm" variant="ghost" className="px-2">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
