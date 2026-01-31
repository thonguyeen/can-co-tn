'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  SOURCES,
  SourcePlatform,
  getSourcesByPlatform,
} from '@/lib/crawlers/source-registry'
import {
  RefreshCw,
  Play,
  ArrowLeft,
  Rss,
  Globe,
  Loader2,
  Radio,
  MessageSquare,
  Video,
  Send,
} from 'lucide-react'
import type { CrawlSummary } from '@/lib/crawlers/unified-crawler'

const PLATFORM_ICONS: Record<SourcePlatform, React.ElementType> = {
  rss: Rss,
  web: Globe,
  twitter: Radio,
  reddit: MessageSquare,
  youtube: Video,
  telegram: Send,
}

const PLATFORM_COLORS: Record<SourcePlatform, string> = {
  rss: '#F97316',
  web: '#6B7280',
  twitter: '#1DA1F2',
  reddit: '#FF4500',
  youtube: '#FF0000',
  telegram: '#0088CC',
}

const PLATFORM_LABELS: Record<SourcePlatform, string> = {
  rss: 'RSS',
  web: 'Web',
  twitter: 'Twitter/X',
  reddit: 'Reddit',
  youtube: 'YouTube',
  telegram: 'Telegram',
}

export default function CrawlerAdminPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [loadingPlatform, setLoadingPlatform] = useState<SourcePlatform | null>(null)
  const [lastCrawl, setLastCrawl] = useState<CrawlSummary | null>(null)
  const [activePlatform, setActivePlatform] = useState<SourcePlatform | 'all'>('all')

  const platforms: SourcePlatform[] = ['rss', 'twitter', 'reddit', 'youtube', 'telegram']

  const runCrawl = async (platform?: SourcePlatform) => {
    if (platform) {
      setLoadingPlatform(platform)
    } else {
      setIsLoading(true)
    }

    try {
      const url = platform
        ? `/api/crawl?platform=${platform}`
        : '/api/crawl'

      const res = await fetch(url, { method: platform ? 'GET' : 'POST', body: platform ? undefined : JSON.stringify({ platforms: platforms }) })
      const data = await res.json()

      if (data.summary) {
        setLastCrawl(data.summary)
      }
    } catch (error) {
      console.error('Crawl error:', error)
    } finally {
      setIsLoading(false)
      setLoadingPlatform(null)
    }
  }

  const filteredSources = activePlatform === 'all'
    ? SOURCES
    : getSourcesByPlatform(activePlatform)

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/demo/admin"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Admin
          </Link>
          <h1 className="text-2xl font-bold">Crawler Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Quản lý {SOURCES.length} nguồn tin từ {platforms.length} nền tảng
          </p>
        </div>
        <Button
          onClick={() => runCrawl()}
          disabled={isLoading}
          className="bg-[#1B4D3E] hover:bg-[#2D6A4F]"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Crawl All
        </Button>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {platforms.map(platform => {
          const Icon = PLATFORM_ICONS[platform]
          const sources = getSourcesByPlatform(platform)
          const color = PLATFORM_COLORS[platform]
          const isActive = activePlatform === platform

          return (
            <Card
              key={platform}
              className={`cursor-pointer transition-all ${isActive ? 'ring-2 ring-[#2D6A4F]' : 'hover:shadow-md'}`}
              onClick={() => setActivePlatform(isActive ? 'all' : platform)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="p-1.5 rounded-md"
                    style={{ backgroundColor: `${color}20` }}
                  >
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {PLATFORM_LABELS[platform]}
                  </span>
                </div>
                <div className="text-2xl font-bold">{sources.length}</div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full mt-2 h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    runCrawl(platform)
                  }}
                  disabled={loadingPlatform === platform || isLoading}
                >
                  {loadingPlatform === platform ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Crawl
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Last Crawl Results */}
      {lastCrawl && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 text-sm">Kết quả crawl gần nhất</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Sources</div>
                <div className="text-xl font-bold">{lastCrawl.totalSources}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Items crawled</div>
                <div className="text-xl font-bold">{lastCrawl.totalItemsCrawled}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Items saved</div>
                <div className="text-xl font-bold text-green-600">{lastCrawl.totalItemsSaved}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Duration</div>
                <div className="text-xl font-bold">
                  {((new Date(lastCrawl.endTime).getTime() - new Date(lastCrawl.startTime).getTime()) / 1000).toFixed(1)}s
                </div>
              </div>
            </div>

            {/* Per-source results */}
            {lastCrawl.results.length > 0 && (
              <div className="mt-4 space-y-1 max-h-48 overflow-y-auto">
                {lastCrawl.results.map(result => {
                  const Icon = PLATFORM_ICONS[result.platform]
                  const color = PLATFORM_COLORS[result.platform]
                  return (
                    <div
                      key={result.sourceId}
                      className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-secondary/30"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" style={{ color }} />
                        <span>{result.sourceName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{result.itemsCrawled} items</span>
                        <span className="text-green-600">{result.itemsSaved} saved</span>
                        {result.errors.length > 0 && (
                          <Badge variant="destructive" className="text-[10px] h-4">
                            {result.errors.length} error
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sources List */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">
              Nguồn tin ({filteredSources.length})
            </h3>
            {activePlatform !== 'all' && (
              <Badge
                variant="outline"
                className="cursor-pointer text-xs"
                onClick={() => setActivePlatform('all')}
              >
                Hiện tất cả
              </Badge>
            )}
          </div>

          <div className="space-y-1">
            {filteredSources.map(source => {
              const Icon = PLATFORM_ICONS[source.platform]
              const color = PLATFORM_COLORS[source.platform]

              return (
                <div
                  key={source.id}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" style={{ color }} />
                    <div>
                      <div className="text-sm font-medium">{source.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {source.category.join(', ')} | Credibility: {source.credibilityScore}/10
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={source.enabled ? 'default' : 'secondary'}
                      className="text-[10px] h-5"
                    >
                      {source.enabled ? 'Active' : 'Off'}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] h-5">
                      P{source.priority}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
