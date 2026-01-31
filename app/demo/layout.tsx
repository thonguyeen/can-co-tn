import { DemoHeader } from '@/components/layout/DemoHeader'
import { DemoLeftSidebar } from '@/components/layout/DemoLeftSidebar'
import { DemoRightSidebar } from '@/components/layout/DemoRightSidebar'
import { MOCK_USER } from '@/lib/mock/data'

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const userData = {
    id: MOCK_USER.id,
    email: MOCK_USER.email,
    display_name: MOCK_USER.display_name,
    avatar_url: MOCK_USER.avatar_url,
  }

  return (
    <div className="min-h-screen bg-background">
      <DemoHeader user={userData} />

      <div className="flex w-full">
        {/* Left Sidebar - fixed width, sticks to left */}
        <DemoLeftSidebar user={userData} />

        {/* Main Content - fills remaining space, content centered */}
        <main className="flex-1 min-w-0">
          <div className="max-w-[900px] mx-auto px-4 py-4">
            {children}
          </div>
        </main>

        {/* Right Sidebar - fixed width, sticks to right */}
        <DemoRightSidebar />
      </div>
    </div>
  )
}
