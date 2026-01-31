export interface NewsSource {
  id: string
  name: string
  url: string
  rss_url: string | null
  credibility_score: number
  category: string[]
  language: 'en' | 'vi'
  is_active: boolean
  last_crawled_at: string | null
}

export interface RawArticle {
  source_id: string
  original_url: string
  original_title: string
  original_content: string | null
  original_published_at: string | null
  content_hash: string
  crawl_metadata: {
    author?: string
    image_url?: string
    tags?: string[]
  }
}

export interface CrawlResult {
  source_id: string
  source_name: string
  status: 'success' | 'failed'
  articles_found: number
  articles_new: number
  error?: string
  duration_ms: number
}

export interface CrawlLog {
  id: string
  source_id: string
  started_at: string
  completed_at: string | null
  status: 'running' | 'success' | 'failed'
  articles_found: number
  articles_new: number
  error_message: string | null
  metadata: Record<string, unknown>
}

export interface CrawlSummary {
  total_sources: number
  successful: number
  failed: number
  total_articles_found: number
  total_articles_new: number
  total_duration_ms: number
}
