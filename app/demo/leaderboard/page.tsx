'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Trophy, Flame, TrendingUp, Target, ArrowLeft, Star } from 'lucide-react'
import { getLevelForPoints, getProgressToNextLevel, LEVELS } from '@/lib/gamification/points'
import { SAMPLE_PREDICTIONS } from '@/lib/gamification/predictions'
import { MOCK_BOTS } from '@/lib/mock/data'
import { UserStats } from '@/components/profile/UserStats'
import { StreakBadge } from '@/components/streak/StreakBadge'

// Mock leaderboard data
const MOCK_LEADERBOARD = [
  { userId: '1', username: 'TechMaster_VN', points: 12500, streak: 45, level: 8, predictions: 12 },
  { userId: '2', username: 'CryptoHunter', points: 9800, streak: 30, level: 7, predictions: 8 },
  { userId: '3', username: 'AIResearcher', points: 7200, streak: 21, level: 7, predictions: 15 },
  { userId: '4', username: 'StartupGuy', points: 5400, streak: 14, level: 6, predictions: 6 },
  { userId: '5', username: 'NewsJunkie22', points: 4100, streak: 10, level: 6, predictions: 9 },
  { userId: '6', username: 'DataDriven', points: 3200, streak: 7, level: 6, predictions: 4 },
  { userId: '7', username: 'GameOnVN', points: 2800, streak: 5, level: 5, predictions: 3 },
  { userId: '8', username: 'FinanceGuru', points: 2100, streak: 12, level: 5, predictions: 7 },
  { userId: '9', username: 'SecurityNerd', points: 1600, streak: 3, level: 5, predictions: 2 },
  { userId: '10', username: 'TrendWatcher', points: 1250, streak: 7, level: 5, predictions: 5 },
]

const AVATAR_COLORS = ['#8B5CF6', '#F97316', '#06B6D4', '#F59E0B', '#10B981', '#EC4899', '#A855F7', '#EF4444', '#6B7280', '#2D6A4F']

type TabValue = 'all_time' | 'weekly' | 'streak' | 'predictions'

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<TabValue>('all_time')
  const [showProfile, setShowProfile] = useState(false)

  const getSortedEntries = () => {
    const entries = [...MOCK_LEADERBOARD]
    switch (activeTab) {
      case 'streak':
        return entries.sort((a, b) => b.streak - a.streak)
      case 'predictions':
        return entries.sort((a, b) => b.predictions - a.predictions)
      case 'weekly':
        return entries.sort((a, b) => (b.points * 0.3) - (a.points * 0.3))
      default:
        return entries
    }
  }

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white'
      case 2: return 'bg-gradient-to-r from-gray-300 to-gray-500 text-white'
      case 3: return 'bg-gradient-to-r from-orange-400 to-orange-600 text-white'
      default: return 'bg-secondary text-foreground'
    }
  }

  const entries = getSortedEntries()

  return (
    <div className="pb-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/demo">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Bang xep hang
            </h1>
            <p className="text-sm text-muted-foreground">Top nguoi dung tich cuc nhat</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowProfile(!showProfile)}
          className="gap-2"
        >
          <Star className="w-4 h-4" />
          {showProfile ? 'Xep hang' : 'Profile'}
        </Button>
      </div>

      {showProfile ? (
        <UserStats />
      ) : (
        <>
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
            <TabsList className="w-full mb-4 bg-card border border-border">
              <TabsTrigger value="all_time" className="flex-1 gap-1 data-[state=active]:bg-[#2D6A4F]/10 data-[state=active]:text-[#2D6A4F]">
                <Trophy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">All Time</span>
              </TabsTrigger>
              <TabsTrigger value="weekly" className="flex-1 gap-1 data-[state=active]:bg-[#2D6A4F]/10 data-[state=active]:text-[#2D6A4F]">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tuan nay</span>
              </TabsTrigger>
              <TabsTrigger value="streak" className="flex-1 gap-1 data-[state=active]:bg-[#2D6A4F]/10 data-[state=active]:text-[#2D6A4F]">
                <Flame className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Streak</span>
              </TabsTrigger>
              <TabsTrigger value="predictions" className="flex-1 gap-1 data-[state=active]:bg-[#2D6A4F]/10 data-[state=active]:text-[#2D6A4F]">
                <Target className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Du doan</span>
              </TabsTrigger>
            </TabsList>

            {/* Leaderboard List */}
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {entries.map((entry, index) => {
                  const rank = index + 1
                  const level = getLevelForPoints(entry.points)
                  return (
                    <div
                      key={entry.userId}
                      className={`flex items-center gap-3 p-3 ${rank <= 3 ? 'bg-secondary/30' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getRankStyle(rank)}`}>
                        {rank <= 3 ? ['', '🥇', '🥈', '🥉'][rank] : rank}
                      </div>

                      <Avatar className="w-9 h-9">
                        <AvatarFallback
                          className="text-white text-xs"
                          style={{ backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }}
                        >
                          {entry.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{entry.username}</div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{level.icon} {level.name}</span>
                          {entry.streak > 0 && (
                            <StreakBadge streak={entry.streak} showLabel={false} />
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-bold text-sm text-[#2D6A4F]">
                          {activeTab === 'predictions'
                            ? `${entry.predictions} dung`
                            : activeTab === 'streak'
                              ? `${entry.streak} ngay`
                              : activeTab === 'weekly'
                                ? `${Math.round(entry.points * 0.3)} pts`
                                : `${entry.points.toLocaleString()} pts`
                          }
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </Tabs>

          {/* Predictions Section */}
          <div className="mt-6">
            <h2 className="font-bold text-base mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-[#2D6A4F]" />
              Du doan dang mo
            </h2>
            <div className="space-y-3">
              {SAMPLE_PREDICTIONS.map((pred, idx) => {
                const bot = MOCK_BOTS.find(b => b.handle === pred.createdBy)
                const totalVotes = pred.options.reduce((sum, o) => sum + o.voteCount, 0)
                return (
                  <Card key={idx}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-sm font-medium">{pred.question}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Boi {bot?.name || pred.createdBy} - Dong {new Date(pred.closesAt).toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {pred.category}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        {pred.options.map(option => {
                          const percentage = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0
                          return (
                            <button
                              key={option.id}
                              className="w-full flex items-center gap-2 p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span>{option.text}</span>
                                  <span className="font-medium text-[#2D6A4F]">{percentage}%</span>
                                </div>
                                <Progress value={percentage} className="h-1 mt-1" />
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      <div className="text-xs text-muted-foreground mt-2">
                        {totalVotes} luot du doan
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
