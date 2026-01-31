'use client'

import { useState } from 'react'
import { Search, Send, Phone, Video, Info, Image, ThumbsUp, Smile, MoreHorizontal, Circle } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { MOCK_USER } from '@/lib/mock/data'

const conversations = [
  { id: '1', name: 'Nguyễn Minh Tuấn', lastMessage: 'Oke, mai mình gặp nhé!', time: '5 phút', unread: 2, online: true, color: '#2D6A4F' },
  { id: '2', name: 'Trần Thị Hương', lastMessage: 'Cảm ơn bạn nhiều 😊', time: '15 phút', unread: 0, online: true, color: '#1B4D3E' },
  { id: '3', name: 'Lê Hoàng Nam', lastMessage: 'File mình gửi rồi nha', time: '1 giờ', unread: 1, online: false, color: '#40916C' },
  { id: '4', name: 'Phạm Thị Mai', lastMessage: 'Haha đúng rồi đó 😂', time: '2 giờ', unread: 0, online: false, color: '#52B788' },
  { id: '5', name: 'Hoàng Đức Anh', lastMessage: 'Deploy xong chưa?', time: '3 giờ', unread: 0, online: true, color: '#74C69D' },
  { id: '6', name: 'Vũ Thị Lan', lastMessage: 'Meeting chiều nay nhé', time: '5 giờ', unread: 0, online: false, color: '#2D6A4F' },
  { id: '7', name: 'Đặng Quốc Bảo', lastMessage: 'Mình review PR rồi', time: '1 ngày', unread: 0, online: false, color: '#1B4D3E' },
  { id: '8', name: 'AI News Vietnam', lastMessage: 'Khoa: Có ai thử GPT-5 chưa?', time: '2 ngày', unread: 5, online: false, color: '#40916C' },
]

const chatMessages: Record<string, Array<{ id: string; sender: 'me' | 'them'; text: string; time: string }>> = {
  '1': [
    { id: 'm1', sender: 'them', text: 'Hey, dự án mới tiến triển thế nào rồi?', time: '10:30' },
    { id: 'm2', sender: 'me', text: 'Đang hoàn thiện phần UI, còn vài trang nữa là xong', time: '10:32' },
    { id: 'm3', sender: 'them', text: 'Ngon! Deadline tuần sau kịp không?', time: '10:33' },
    { id: 'm4', sender: 'me', text: 'Kịp chứ, mình ước lượng thứ 5 là xong hết', time: '10:35' },
    { id: 'm5', sender: 'them', text: 'Tuyệt vời! Mai mình gặp nói chi tiết hơn nhé', time: '10:36' },
    { id: 'm6', sender: 'me', text: 'Ok bạn, mai gặp!', time: '10:37' },
    { id: 'm7', sender: 'them', text: 'Oke, mai mình gặp nhé!', time: '10:38' },
  ],
  '2': [
    { id: 'm1', sender: 'me', text: 'Mình gửi bạn link figma nha', time: '09:15' },
    { id: 'm2', sender: 'them', text: 'Nhận được rồi, design đẹp quá!', time: '09:20' },
    { id: 'm3', sender: 'them', text: 'Cảm ơn bạn nhiều 😊', time: '09:20' },
  ],
  '3': [
    { id: 'm1', sender: 'them', text: 'Bạn cần file specs không?', time: '08:00' },
    { id: 'm2', sender: 'me', text: 'Ừ gửi mình với', time: '08:05' },
    { id: 'm3', sender: 'them', text: 'File mình gửi rồi nha', time: '08:10' },
  ],
}

export default function MessengerPage() {
  const [selectedChat, setSelectedChat] = useState<string>('1')
  const [searchQuery, setSearchQuery] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const [localMessages, setLocalMessages] = useState(chatMessages)

  const filteredConversations = conversations.filter(c =>
    !searchQuery.trim() || c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const currentChat = conversations.find(c => c.id === selectedChat)
  const currentMessages = localMessages[selectedChat] || []

  const sendMessage = () => {
    if (!messageInput.trim()) return
    const newMsg = {
      id: `m${Date.now()}`,
      sender: 'me' as const,
      text: messageInput.trim(),
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    }
    setLocalMessages(prev => ({
      ...prev,
      [selectedChat]: [...(prev[selectedChat] || []), newMsg],
    }))
    setMessageInput('')
  }

  return (
    <div className="max-w-[1000px] mx-auto -mt-4 -mx-4">
      <div className="flex h-[calc(100vh-56px)]">
        {/* Left - Conversation List */}
        <div className={cn(
          'w-[340px] border-r border-border flex flex-col shrink-0',
          'max-md:w-full',
          selectedChat && 'max-md:hidden'
        )}>
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-2xl font-bold">Chat</h1>
              <Button variant="ghost" size="icon" className="w-9 h-9">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm trên Messenger"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-secondary border-none rounded-full h-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedChat(conv.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/50 transition-colors',
                  selectedChat === conv.id && 'bg-secondary/70'
                )}
              >
                <div className="relative">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="text-white font-bold" style={{ backgroundColor: conv.color }}>
                      {conv.name.split(' ').slice(-1)[0][0]}
                    </AvatarFallback>
                  </Avatar>
                  {conv.online && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-card" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className={cn('text-[15px] truncate', conv.unread > 0 ? 'font-bold' : 'font-medium')}>
                    {conv.name}
                  </p>
                  <p className={cn('text-sm truncate', conv.unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                    {conv.lastMessage}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-muted-foreground">{conv.time}</span>
                  {conv.unread > 0 && (
                    <span className="w-5 h-5 bg-[#2D6A4F] text-white text-xs rounded-full flex items-center justify-center">
                      {conv.unread}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right - Chat Area */}
        <div className={cn(
          'flex-1 flex flex-col min-w-0',
          !selectedChat && 'max-md:hidden'
        )}>
          {currentChat ? (
            <>
              {/* Chat Header */}
              <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-3">
                  <button className="md:hidden mr-2 text-muted-foreground" onClick={() => setSelectedChat('')}>
                    ←
                  </button>
                  <div className="relative">
                    <Avatar className="w-9 h-9">
                      <AvatarFallback className="text-white text-sm" style={{ backgroundColor: currentChat.color }}>
                        {currentChat.name.split(' ').slice(-1)[0][0]}
                      </AvatarFallback>
                    </Avatar>
                    {currentChat.online && (
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-[15px]">{currentChat.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {currentChat.online ? 'Đang hoạt động' : 'Không hoạt động'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="w-9 h-9 rounded-full text-[#2D6A4F]">
                    <Phone className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-9 h-9 rounded-full text-[#2D6A4F]">
                    <Video className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-9 h-9 rounded-full text-[#2D6A4F]">
                    <Info className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {currentMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn('flex', msg.sender === 'me' ? 'justify-end' : 'justify-start')}
                  >
                    <div className={cn('flex items-end gap-2 max-w-[70%]', msg.sender === 'me' && 'flex-row-reverse')}>
                      {msg.sender === 'them' && (
                        <Avatar className="w-7 h-7 shrink-0">
                          <AvatarFallback className="text-white text-[10px]" style={{ backgroundColor: currentChat.color }}>
                            {currentChat.name.split(' ').slice(-1)[0][0]}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div>
                        <div
                          className={cn(
                            'px-3 py-2 rounded-2xl text-[15px]',
                            msg.sender === 'me'
                              ? 'bg-[#2D6A4F] text-white rounded-br-sm'
                              : 'bg-secondary rounded-bl-sm'
                          )}
                        >
                          {msg.text}
                        </div>
                        <p className={cn('text-[10px] text-muted-foreground mt-0.5', msg.sender === 'me' ? 'text-right' : 'text-left')}>
                          {msg.time}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border flex items-center gap-2">
                <Button variant="ghost" size="icon" className="w-9 h-9 shrink-0 text-[#2D6A4F]">
                  <Image className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className="w-9 h-9 shrink-0 text-[#2D6A4F]">
                  <Smile className="w-5 h-5" />
                </Button>
                <Input
                  placeholder="Aa"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  className="flex-1 rounded-full bg-secondary border-none"
                />
                {messageInput.trim() ? (
                  <Button
                    size="icon"
                    className="w-9 h-9 rounded-full bg-[#2D6A4F] hover:bg-[#1B4D3E] shrink-0"
                    onClick={sendMessage}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon" className="w-9 h-9 shrink-0 text-[#2D6A4F]">
                    <ThumbsUp className="w-5 h-5" />
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p>Chọn một cuộc trò chuyện để bắt đầu</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
