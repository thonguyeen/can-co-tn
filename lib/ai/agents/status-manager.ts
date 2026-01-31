import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type VerificationStatus = 'unverified' | 'partial' | 'verified' | 'debunked'

interface StatusUpdate {
  postId: string
  oldStatus: VerificationStatus
  newStatus: VerificationStatus
  note: string
}

export async function updatePostStatus(
  postId: string,
  newStatus: VerificationStatus,
  note: string
): Promise<StatusUpdate | null> {
  const supabase = getSupabaseAdmin()

  // Get current status
  const { data: post } = await supabase
    .from('posts')
    .select('verification_status')
    .eq('id', postId)
    .single()

  if (!post) return null

  const oldStatus = post.verification_status as VerificationStatus

  // Skip if no change
  if (oldStatus === newStatus) return null

  // Update post
  await supabase
    .from('posts')
    .update({
      verification_status: newStatus,
      verification_note: note,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)

  // Record in post_updates (for history/timeline)
  await supabase.from('post_updates').insert({
    post_id: postId,
    old_status: oldStatus,
    new_status: newStatus,
    note: note,
  })

  return {
    postId,
    oldStatus,
    newStatus,
    note,
  }
}

export async function getPostVerificationHistory(postId: string) {
  const supabase = getSupabaseAdmin()

  const { data } = await supabase
    .from('post_updates')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: false })

  return data || []
}

// Auto-update posts that have been unverified for too long
export async function reviewStaleUnverifiedPosts() {
  const supabase = getSupabaseAdmin()
  const STALE_HOURS = 24

  const { data: stalePosts } = await supabase
    .from('posts')
    .select('id, created_at')
    .eq('verification_status', 'unverified')
    .lt(
      'created_at',
      new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString()
    )

  if (!stalePosts) return

  for (const post of stalePosts) {
    // Mark as partial if still unverified after 24h
    await updatePostStatus(
      post.id,
      'partial',
      'Không tìm được nguồn xác nhận thêm sau 24 giờ. Đọc với cẩn trọng.'
    )
  }
}
