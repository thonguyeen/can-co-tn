// ═══════════════════════════════════════════════════════════════
// PREDICTION MARKET
// ═══════════════════════════════════════════════════════════════

import { awardPoints } from './points'
import { checkAchievement } from './achievements'

export interface Prediction {
  id: string
  question: string
  category: string
  options: PredictionOption[]
  createdBy: string
  status: 'open' | 'closed' | 'resolved'
  correctOption?: string
  resolvedAt?: string
  closesAt: string
  createdAt: string
  totalParticipants: number
}

export interface PredictionOption {
  id: string
  text: string
  odds?: number
  voteCount: number
}

export interface UserPrediction {
  id: string
  predictionId: string
  userId: string
  optionId: string
  confidence: number
  createdAt: string
  result?: 'correct' | 'wrong' | 'pending'
  pointsEarned?: number
}

// ═══════════════════════════════════════════════════════════════
// SAMPLE PREDICTIONS (for demo)
// ═══════════════════════════════════════════════════════════════

export const SAMPLE_PREDICTIONS: Omit<Prediction, 'id' | 'totalParticipants' | 'createdAt'>[] = [
  {
    question: 'OpenAI co ra mat GPT-5 truoc Q2 2026?',
    category: 'ai',
    options: [
      { id: 'yes', text: 'Co', voteCount: 67 },
      { id: 'no', text: 'Khong', voteCount: 33 },
    ],
    createdBy: 'minh_ai',
    status: 'open',
    closesAt: new Date('2026-04-01').toISOString(),
  },
  {
    question: 'Bitcoin se dat $200k trong nam 2026?',
    category: 'crypto',
    options: [
      { id: 'yes', text: 'Co, chac chan', voteCount: 42 },
      { id: 'maybe', text: 'Co the, 50/50', voteCount: 35 },
      { id: 'no', text: 'Khong, se duoi $200k', voteCount: 23 },
    ],
    createdBy: 'hung_crypto',
    status: 'open',
    closesAt: new Date('2026-12-31').toISOString(),
  },
  {
    question: 'Apple se ra iPhone fold nam nay?',
    category: 'gadget',
    options: [
      { id: 'yes', text: 'Co', voteCount: 28 },
      { id: 'no', text: 'Khong', voteCount: 72 },
    ],
    createdBy: 'nam_gadget',
    status: 'open',
    closesAt: new Date('2026-09-30').toISOString(),
  },
  {
    question: 'VN-Index se vuot 1500 diem trong Q1/2026?',
    category: 'finance',
    options: [
      { id: 'yes', text: 'Co', voteCount: 55 },
      { id: 'no', text: 'Khong', voteCount: 45 },
    ],
    createdBy: 'mai_finance',
    status: 'open',
    closesAt: new Date('2026-03-31').toISOString(),
  },
]

// ═══════════════════════════════════════════════════════════════
// PREDICTION OPERATIONS
// ═══════════════════════════════════════════════════════════════

export async function createPrediction(
  prediction: Omit<Prediction, 'id' | 'totalParticipants' | 'createdAt' | 'status'>
): Promise<Prediction> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('predictions')
    .insert({
      question: prediction.question,
      category: prediction.category,
      options: prediction.options,
      created_by: prediction.createdBy,
      closes_at: prediction.closesAt,
      status: 'open',
      total_participants: 0,
    })
    .select()
    .single()

  if (error) throw error

  return {
    id: data.id,
    question: data.question,
    category: data.category,
    options: data.options,
    createdBy: data.created_by,
    status: data.status,
    closesAt: data.closes_at,
    createdAt: data.created_at,
    totalParticipants: data.total_participants,
  }
}

export async function makePrediction(
  userId: string,
  predictionId: string,
  optionId: string,
  confidence: number = 5
): Promise<UserPrediction> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: existing } = await supabase
    .from('user_predictions')
    .select('id')
    .eq('user_id', userId)
    .eq('prediction_id', predictionId)
    .single()

  if (existing) throw new Error('Already made a prediction')

  const { data: prediction } = await supabase
    .from('predictions')
    .select('status, closes_at')
    .eq('id', predictionId)
    .single()

  if (!prediction || prediction.status !== 'open') {
    throw new Error('Prediction is not open')
  }

  if (new Date(prediction.closes_at) < new Date()) {
    throw new Error('Prediction has closed')
  }

  const { data, error } = await supabase
    .from('user_predictions')
    .insert({
      user_id: userId,
      prediction_id: predictionId,
      option_id: optionId,
      confidence: Math.min(10, Math.max(1, confidence)),
      result: 'pending',
    })
    .select()
    .single()

  if (error) throw error

  await supabase.rpc('increment_prediction_votes', {
    p_id: predictionId,
    opt_id: optionId,
  })

  await supabase.rpc('increment_user_stat', {
    p_user_id: userId,
    p_stat: 'predictions_made',
  })

  return {
    id: data.id,
    predictionId: data.prediction_id,
    userId: data.user_id,
    optionId: data.option_id,
    confidence: data.confidence,
    createdAt: data.created_at,
    result: data.result,
  }
}

export async function resolvePrediction(
  predictionId: string,
  correctOptionId: string
): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await supabase
    .from('predictions')
    .update({
      status: 'resolved',
      correct_option: correctOptionId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', predictionId)

  const { data: userPredictions } = await supabase
    .from('user_predictions')
    .select('*')
    .eq('prediction_id', predictionId)

  if (!userPredictions) return

  for (const up of userPredictions) {
    const isCorrect = up.option_id === correctOptionId
    const result = isCorrect ? 'correct' : 'wrong'

    let points = 0
    if (isCorrect) {
      points = Math.round(50 * (1 + (up.confidence - 5) * 0.1))
    } else {
      points = -10
    }

    await supabase
      .from('user_predictions')
      .update({ result, points_earned: points })
      .eq('id', up.id)

    await awardPoints(
      up.user_id,
      isCorrect ? 'prediction_correct' : 'prediction_wrong',
      { prediction_id: predictionId, confidence: up.confidence }
    )

    if (isCorrect) {
      await checkAchievement(up.user_id, 'oracle')
    }

    await supabase.from('notifications').insert({
      user_id: up.user_id,
      type: 'prediction_result',
      title: isCorrect ? 'Du doan dung!' : 'Du doan sai',
      message: isCorrect
        ? `Ban da du doan dung va nhan ${points} diem!`
        : `Du doan cua ban khong chinh xac.`,
      data: { prediction_id: predictionId, result, points },
    })
  }
}

export async function getOpenPredictions(
  category?: string,
  limit: number = 10
): Promise<Prediction[]> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let query = supabase
    .from('predictions')
    .select('*')
    .eq('status', 'open')
    .gt('closes_at', new Date().toISOString())
    .order('closes_at', { ascending: true })
    .limit(limit)

  if (category) {
    query = query.eq('category', category)
  }

  const { data } = await query

  return (data || []).map(d => ({
    id: d.id,
    question: d.question,
    category: d.category,
    options: d.options,
    createdBy: d.created_by,
    status: d.status,
    closesAt: d.closes_at,
    createdAt: d.created_at,
    totalParticipants: d.total_participants,
  }))
}
