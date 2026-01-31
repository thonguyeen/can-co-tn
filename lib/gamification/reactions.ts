// ═══════════════════════════════════════════════════════════════
// EXPANDED REACTION SYSTEM
// ═══════════════════════════════════════════════════════════════

import { awardPoints } from './points'

export type ReactionType =
  | 'like'
  | 'love'
  | 'insightful'
  | 'funny'
  | 'skeptical'
  | 'angry'
  | 'fire'
  | 'mindblown'

export interface Reaction {
  type: ReactionType
  icon: string
  label: string
  points: number
}

export const REACTIONS: Record<ReactionType, Reaction> = {
  like: { type: 'like', icon: '❤️', label: 'Thich', points: 2 },
  love: { type: 'love', icon: '😍', label: 'Yeu thich', points: 3 },
  insightful: { type: 'insightful', icon: '💡', label: 'Sau sac', points: 5 },
  funny: { type: 'funny', icon: '😂', label: 'Hai huoc', points: 2 },
  skeptical: { type: 'skeptical', icon: '🤔', label: 'Hoai nghi', points: 1 },
  angry: { type: 'angry', icon: '😠', label: 'Buc minh', points: 1 },
  fire: { type: 'fire', icon: '🔥', label: 'Hot', points: 4 },
  mindblown: { type: 'mindblown', icon: '🤯', label: 'Kinh ngac', points: 5 },
}

// ═══════════════════════════════════════════════════════════════
// REACTION OPERATIONS
// ═══════════════════════════════════════════════════════════════

export async function addReaction(
  userId: string,
  targetType: 'post' | 'comment',
  targetId: string,
  reactionType: ReactionType
): Promise<{ action: 'added' | 'changed' | 'removed' }> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: existing } = await supabase
    .from('reactions')
    .select('id, reaction_type')
    .eq('user_id', userId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .single()

  if (existing) {
    if (existing.reaction_type === reactionType) {
      await supabase.from('reactions').delete().eq('id', existing.id)
      return { action: 'removed' }
    } else {
      await supabase
        .from('reactions')
        .update({ reaction_type: reactionType })
        .eq('id', existing.id)
      return { action: 'changed' }
    }
  }

  await supabase.from('reactions').insert({
    user_id: userId,
    target_type: targetType,
    target_id: targetId,
    reaction_type: reactionType,
  })

  // Award points to reactor
  await awardPoints(userId, 'like_post', { reaction_type: reactionType })

  // Award points to content creator
  const creatorId = await getContentCreatorId(supabase, targetType, targetId)
  if (creatorId && creatorId !== userId) {
    await awardPoints(creatorId, 'receive_like', {
      reaction_type: reactionType,
      target_type: targetType,
      target_id: targetId,
    })
  }

  return { action: 'added' }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getContentCreatorId(
  supabase: any,
  targetType: 'post' | 'comment',
  targetId: string
): Promise<string | null> {
  const table = targetType === 'post' ? 'posts' : 'comments'

  const { data } = await supabase
    .from(table)
    .select('user_id')
    .eq('id', targetId)
    .single()

  return data?.user_id || null
}

export async function getReactions(
  targetType: 'post' | 'comment',
  targetId: string
): Promise<Record<ReactionType, number>> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await supabase
    .from('reactions')
    .select('reaction_type')
    .eq('target_type', targetType)
    .eq('target_id', targetId)

  const counts: Record<ReactionType, number> = {
    like: 0, love: 0, insightful: 0, funny: 0,
    skeptical: 0, angry: 0, fire: 0, mindblown: 0,
  }

  ;(data || []).forEach(r => {
    counts[r.reaction_type as ReactionType]++
  })

  return counts
}

export async function getUserReaction(
  userId: string,
  targetType: 'post' | 'comment',
  targetId: string
): Promise<ReactionType | null> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await supabase
    .from('reactions')
    .select('reaction_type')
    .eq('user_id', userId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .single()

  return (data?.reaction_type as ReactionType) || null
}
