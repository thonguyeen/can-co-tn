import { createClient } from '@supabase/supabase-js'
import { parseRSSFeed } from './rss-parser'
import { scrapeWebPage } from './web-scraper'
import type { NewsSource, RawArticle, CrawlResult } from './types'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function crawlSource(source: NewsSource): Promise<CrawlResult> {
  const startTime = Date.now()
  const supabase = getSupabaseAdmin()

  // Create crawl log entry
  const { data: logEntry } = await supabase
    .from('crawl_logs')
    .insert({
      source_id: source.id,
      status: 'running',
    })
    .select()
    .single()

  try {
    // Fetch articles
    let articles: RawArticle[]

    if (source.rss_url) {
      articles = await parseRSSFeed(source)
    } else {
      articles = await scrapeWebPage(source)
    }

    // Deduplicate against existing
    const newArticles = await deduplicateArticles(articles)

    // Insert new articles
    if (newArticles.length > 0) {
      await supabase.from('raw_news').insert(newArticles)
    }

    // Update source last_crawled_at
    await supabase
      .from('sources')
      .update({ last_crawled_at: new Date().toISOString() })
      .eq('id', source.id)

    // Update crawl log
    if (logEntry) {
      await supabase
        .from('crawl_logs')
        .update({
          status: 'success',
          completed_at: new Date().toISOString(),
          articles_found: articles.length,
          articles_new: newArticles.length,
        })
        .eq('id', logEntry.id)
    }

    return {
      source_id: source.id,
      source_name: source.name,
      status: 'success',
      articles_found: articles.length,
      articles_new: newArticles.length,
      duration_ms: Date.now() - startTime,
    }
  } catch (error) {
    // Update crawl log with error
    if (logEntry) {
      await supabase
        .from('crawl_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message:
            error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', logEntry.id)
    }

    return {
      source_id: source.id,
      source_name: source.name,
      status: 'failed',
      articles_found: 0,
      articles_new: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: Date.now() - startTime,
    }
  }
}

async function deduplicateArticles(
  articles: RawArticle[]
): Promise<RawArticle[]> {
  if (articles.length === 0) return []

  const supabase = getSupabaseAdmin()

  // Get existing content hashes
  const hashes = articles.map((a) => a.content_hash)

  const { data: existing } = await supabase
    .from('raw_news')
    .select('content_hash')
    .in('content_hash', hashes)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingHashes = new Set(
    (existing as any[])?.map((e) => e.content_hash) || []
  )

  return articles.filter((a) => !existingHashes.has(a.content_hash))
}

export async function crawlAllSources(): Promise<CrawlResult[]> {
  const supabase = getSupabaseAdmin()

  // Get all active sources
  const { data: sources } = await supabase
    .from('sources')
    .select('*')
    .eq('is_active', true)

  if (!sources || sources.length === 0) {
    return []
  }

  // Crawl sources in parallel (with limit)
  const CONCURRENT_LIMIT = 5
  const results: CrawlResult[] = []

  for (let i = 0; i < sources.length; i += CONCURRENT_LIMIT) {
    const batch = sources.slice(i, i + CONCURRENT_LIMIT)
    const batchResults = await Promise.all(
      batch.map((source) => crawlSource(source as NewsSource))
    )
    results.push(...batchResults)
  }

  return results
}

export async function crawlSingleSource(
  sourceId: string
): Promise<CrawlResult> {
  const supabase = getSupabaseAdmin()

  const { data: source } = await supabase
    .from('sources')
    .select('*')
    .eq('id', sourceId)
    .single()

  if (!source) {
    throw new Error(`Source not found: ${sourceId}`)
  }

  return crawlSource(source as NewsSource)
}
