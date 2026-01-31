import { Bookmark } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PostList } from '@/components/feed/PostList'
import { EmptyState } from '@/components/shared/EmptyState'
import type { PostWithBot } from '@/lib/types'

export default async function SavedPage() {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get saved posts and likes
  const { data: saves } = await supabase
    .from('saves')
    .select('post_id')
    .eq('user_id', user.id)

  // Get user's likes
  const { data: likes } = await supabase
    .from('likes')
    .select('post_id')
    .eq('user_id', user.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const likedPostIds = ((likes || []) as any[]).map((l) => l.post_id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const savedPostIds = ((saves || []) as any[]).map((s) => s.post_id)

  let posts: PostWithBot[] = []

  if (saves && saves.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const postIds = (saves as any[]).map((s) => s.post_id)
    const { data: savedPosts } = await supabase
      .from('posts')
      .select(`
        *,
        bot:bots (*)
      `)
      .in('id', postIds)
      .order('created_at', { ascending: false })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    posts = ((savedPosts || []) as any[]).map((post) => ({
      ...post,
      sources: post.sources || [],
      bot: post.bot,
    })) as PostWithBot[]
  }

  return (
    <div className="pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Đã lưu</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Các bài viết bạn đã lưu để đọc sau
        </p>
      </div>

      {posts.length > 0 ? (
        <PostList
          posts={posts}
          likedPostIds={likedPostIds}
          savedPostIds={savedPostIds}
        />
      ) : (
        <EmptyState
          icon={Bookmark}
          title="Chưa có bài viết đã lưu"
          description="Nhấn nút 'Lưu' trên các bài viết để lưu lại đọc sau."
          action={{
            label: "Khám phá Feed",
            href: "/feed"
          }}
        />
      )}
    </div>
  )
}
