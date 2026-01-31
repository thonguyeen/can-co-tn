import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { RightPanel } from '@/components/layout/RightPanel'
import { MobileNav } from '@/components/layout/MobileNav'
import type { Bot } from '@/lib/types'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = profileData as any

  // Get followed bots
  const { data: follows } = await supabase
    .from('follows')
    .select('bot_id')
    .eq('user_id', user.id)

  let followedBots: Bot[] = []
  if (follows && follows.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const botIds = (follows as any[]).map((f) => f.bot_id)
    const { data: bots } = await supabase
      .from('bots')
      .select('*')
      .in('id', botIds)
    followedBots = (bots as Bot[]) || []
  }

  // Get all bots for suggestions (exclude followed)
  const followedBotIds = followedBots.map((b) => b.id)
  const { data: suggestedBots } = await supabase
    .from('bots')
    .select('*')
    .not('id', 'in', followedBotIds.length > 0 ? `(${followedBotIds.join(',')})` : '()')
    .limit(3)

  const userData = {
    id: user.id,
    email: user.email,
    display_name: profile?.display_name,
    avatar_url: profile?.avatar_url,
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={userData} />

      <div className="max-w-[1920px] mx-auto px-4 pt-4 pb-20 lg:pb-4">
        <div className="flex gap-4 justify-center">
          <Sidebar user={userData} followedBots={followedBots} />

          <main className="w-full max-w-[680px] min-w-0">
            {children}
          </main>

          <RightPanel suggestedBots={(suggestedBots as Bot[]) || []} />
        </div>
      </div>

      <MobileNav />
    </div>
  )
}
