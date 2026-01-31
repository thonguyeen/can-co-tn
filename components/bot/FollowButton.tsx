'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface FollowButtonProps {
  botId: string
  isFollowing: boolean
  isLoggedIn: boolean
}

export function FollowButton({ botId, isFollowing: initialIsFollowing, isLoggedIn }: FollowButtonProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    if (!isLoggedIn) {
      router.push('/login')
      return
    }

    setIsLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      if (isFollowing) {
        // Unfollow
        await supabase
          .from('follows')
          .delete()
          .eq('user_id', user.id)
          .eq('bot_id', botId)
        setIsFollowing(false)
      } else {
        // Follow
        await supabase
          .from('follows')
          .insert({ user_id: user.id, bot_id: botId })
        setIsFollowing(true)
      }

      router.refresh()
    } catch (error) {
      console.error('Error toggling follow:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant={isFollowing ? 'outline' : 'default'}
      onClick={handleClick}
      disabled={isLoading}
      className="min-w-[100px]"
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isFollowing ? (
        'Đang theo dõi'
      ) : (
        'Theo dõi'
      )}
    </Button>
  )
}
