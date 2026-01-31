// ═══════════════════════════════════════════════════════════════
// REALTIME FEED SUBSCRIPTION
// Supabase Realtime for live post updates
// ═══════════════════════════════════════════════════════════════

import { createClient, RealtimeChannel } from '@supabase/supabase-js'

export interface RealtimePost {
  id: string
  bot_id: string
  content: string
  verification_status: string
  verification_note: string | null
  sources: { url: string; title: string }[]
  likes_count: number
  comments_count: number
  saves_count: number
  importance_score: number
  created_at: string
}

export interface RealtimeBreaking {
  id: string
  post_id: string
  headline: string
  summary: string
  urgency_level: string
  category: string
  is_active: boolean
  expires_at: string
  created_at: string
}

export type FeedEventType = 'new_post' | 'post_updated' | 'breaking_news' | 'breaking_expired'

export interface FeedEvent {
  type: FeedEventType
  payload: RealtimePost | RealtimeBreaking
  timestamp: string
}

export type FeedEventHandler = (event: FeedEvent) => void

// ═══════════════════════════════════════════════════════════════
// SUBSCRIPTION MANAGER
// ═══════════════════════════════════════════════════════════════

export class FeedSubscription {
  private supabase
  private postsChannel: RealtimeChannel | null = null
  private breakingChannel: RealtimeChannel | null = null
  private handlers: Set<FeedEventHandler> = new Set()
  private isSubscribed = false

  private isConfigured = false

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Check if credentials are placeholder/invalid
    if (!url || !key || url.includes('placeholder')) {
      console.log('[FeedSubscription] Supabase not configured, realtime disabled')
      this.isConfigured = false
      // Create a dummy client that won't connect
      this.supabase = null as unknown as ReturnType<typeof createClient>
      return
    }

    this.isConfigured = true
    this.supabase = createClient(url, key)
  }

  /**
   * Subscribe to feed events
   */
  subscribe(handler: FeedEventHandler): () => void {
    this.handlers.add(handler)

    if (!this.isSubscribed) {
      this.startListening()
    }

    // Return unsubscribe function
    return () => {
      this.handlers.delete(handler)
      if (this.handlers.size === 0) {
        this.stopListening()
      }
    }
  }

  private startListening() {
    // Skip if Supabase not configured
    if (!this.isConfigured || !this.supabase) {
      return
    }

    this.isSubscribed = true

    // Subscribe to new posts
    this.postsChannel = this.supabase
      .channel('realtime-posts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
        },
        (payload) => {
          this.emit({
            type: 'new_post',
            payload: payload.new as RealtimePost,
            timestamp: new Date().toISOString(),
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'posts',
        },
        (payload) => {
          this.emit({
            type: 'post_updated',
            payload: payload.new as RealtimePost,
            timestamp: new Date().toISOString(),
          })
        }
      )
      .subscribe()

    // Subscribe to breaking news
    this.breakingChannel = this.supabase
      .channel('realtime-breaking')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'breaking_news',
        },
        (payload) => {
          this.emit({
            type: 'breaking_news',
            payload: payload.new as RealtimeBreaking,
            timestamp: new Date().toISOString(),
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'breaking_news',
          filter: 'is_active=eq.false',
        },
        (payload) => {
          this.emit({
            type: 'breaking_expired',
            payload: payload.new as RealtimeBreaking,
            timestamp: new Date().toISOString(),
          })
        }
      )
      .subscribe()
  }

  private stopListening() {
    this.isSubscribed = false

    if (!this.isConfigured || !this.supabase) {
      return
    }

    if (this.postsChannel) {
      this.supabase.removeChannel(this.postsChannel)
      this.postsChannel = null
    }

    if (this.breakingChannel) {
      this.supabase.removeChannel(this.breakingChannel)
      this.breakingChannel = null
    }
  }

  private emit(event: FeedEvent) {
    for (const handler of this.handlers) {
      try {
        handler(event)
      } catch (error) {
        console.error('Feed event handler error:', error)
      }
    }
  }

  /**
   * Cleanup all subscriptions
   */
  destroy() {
    this.stopListening()
    this.handlers.clear()
  }
}

// Singleton instance for client-side use
let feedSubscriptionInstance: FeedSubscription | null = null

export function getFeedSubscription(): FeedSubscription {
  if (!feedSubscriptionInstance) {
    feedSubscriptionInstance = new FeedSubscription()
  }
  return feedSubscriptionInstance
}
