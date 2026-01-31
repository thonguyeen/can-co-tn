'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { FeedEvent, RealtimePost, RealtimeBreaking } from '@/lib/realtime/feed-subscription'

interface UseRealtimeFeedOptions {
  enabled?: boolean
  onNewPost?: (post: RealtimePost) => void
  onBreaking?: (breaking: RealtimeBreaking) => void
}

interface UseRealtimeFeedReturn {
  newPostsCount: number
  breakingNews: RealtimeBreaking[]
  isConnected: boolean
  clearNewPosts: () => void
  dismissBreaking: (id: string) => void
}

export function useRealtimeFeed(options: UseRealtimeFeedOptions = {}): UseRealtimeFeedReturn {
  const { enabled = true, onNewPost, onBreaking } = options
  const [newPostsCount, setNewPostsCount] = useState(0)
  const [breakingNews, setBreakingNews] = useState<RealtimeBreaking[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!enabled) return

    // Skip realtime if using placeholder Supabase credentials
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    if (supabaseUrl.includes('placeholder') || !supabaseUrl) {
      console.log('[Realtime] Skipping - Supabase not configured')
      return
    }

    let mounted = true

    const setupSubscription = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const { getFeedSubscription } = await import('@/lib/realtime/feed-subscription')
        const subscription = getFeedSubscription()

        const handler = (event: FeedEvent) => {
          if (!mounted) return

          switch (event.type) {
            case 'new_post':
              setNewPostsCount(prev => prev + 1)
              onNewPost?.(event.payload as RealtimePost)
              break

            case 'breaking_news': {
              const breaking = event.payload as RealtimeBreaking
              setBreakingNews(prev => [breaking, ...prev])
              onBreaking?.(breaking)
              break
            }

            case 'breaking_expired': {
              const expired = event.payload as RealtimeBreaking
              setBreakingNews(prev => prev.filter(b => b.id !== expired.id))
              break
            }
          }
        }

        unsubscribeRef.current = subscription.subscribe(handler)
        if (mounted) setIsConnected(true)
      } catch (error) {
        console.error('Realtime feed setup error:', error)
        if (mounted) setIsConnected(false)
      }
    }

    setupSubscription()

    return () => {
      mounted = false
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      setIsConnected(false)
    }
  }, [enabled, onNewPost, onBreaking])

  // Check breaking news expiry periodically
  useEffect(() => {
    if (breakingNews.length === 0) return

    const interval = setInterval(() => {
      const now = Date.now()
      setBreakingNews(prev =>
        prev.filter(b => new Date(b.expires_at).getTime() > now)
      )
    }, 30000) // Check every 30s

    return () => clearInterval(interval)
  }, [breakingNews.length])

  const clearNewPosts = useCallback(() => {
    setNewPostsCount(0)
  }, [])

  const dismissBreaking = useCallback((id: string) => {
    setBreakingNews(prev => prev.filter(b => b.id !== id))
  }, [])

  return {
    newPostsCount,
    breakingNews,
    isConnected,
    clearNewPosts,
    dismissBreaking,
  }
}
