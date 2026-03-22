// ═══════════════════════════════════════════════════════
// CẦN & CÓ — Knowledge Graph (PostgreSQL-based)
// ═══════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Intent } from '@/lib/engine/types';

export interface KnowledgeEdge {
  source_type: string;
  source_id: string;
  relation: string;
  target_type: string;
  target_id: string;
  weight: number;
  metadata?: Record<string, unknown>;
}

export async function addEdge(
  edge: KnowledgeEdge,
  supabase: SupabaseClient,
): Promise<void> {
  try {
    await supabase.from('knowledge_edges').upsert({
      source_type: edge.source_type,
      source_id: edge.source_id,
      relation: edge.relation,
      target_type: edge.target_type,
      target_id: edge.target_id,
      weight: edge.weight,
      metadata: edge.metadata || {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'source_type,source_id,relation,target_type,target_id' });
  } catch { /* non-critical */ }
}

export async function buildEdgesForIntent(intent: Intent, supabase: SupabaseClient): Promise<void> {
  const edges: KnowledgeEdge[] = [
    { source_type: 'intent', source_id: intent.id, relation: 'posted_by', target_type: 'user', target_id: intent.user_id, weight: 1.0 },
    { source_type: 'intent', source_id: intent.id, relation: 'in_category', target_type: 'category', target_id: intent.category, weight: 1.0 },
  ];

  if (intent.district) {
    edges.push(
      { source_type: 'intent', source_id: intent.id, relation: 'in_district', target_type: 'district', target_id: intent.district, weight: 1.0 },
      { source_type: 'user', source_id: intent.user_id, relation: 'interested_in', target_type: 'district', target_id: intent.district, weight: 0.8 },
    );
  }

  for (const edge of edges) {
    await addEdge(edge, supabase);
  }
}

export async function buildEdgesForMatch(
  canUserId: string, coUserId: string, similarity: number, intentIds: string[],
  supabase: SupabaseClient,
): Promise<void> {
  await addEdge({
    source_type: 'user', source_id: canUserId,
    relation: 'potential_connection', target_type: 'user', target_id: coUserId,
    weight: similarity, metadata: { reason: 'CẦN↔CÓ match', intent_ids: intentIds },
  }, supabase);
}

export async function buildEdgesForChat(userA: string, userB: string, supabase: SupabaseClient): Promise<void> {
  await addEdge({
    source_type: 'user', source_id: userA,
    relation: 'chatted_with', target_type: 'user', target_id: userB,
    weight: 0.9,
  }, supabase);
}

export async function buildEdgesForReaction(userId: string, intentId: string, type: string, supabase: SupabaseClient): Promise<void> {
  const weight = type === 'interested' ? 0.7 : type === 'fair_price' ? 0.5 : 0.3;
  await addEdge({
    source_type: 'user', source_id: userId,
    relation: 'reacted_to', target_type: 'intent', target_id: intentId,
    weight,
  }, supabase);
}

export async function buildEdgesForSave(userId: string, intentId: string, district: string | null, supabase: SupabaseClient): Promise<void> {
  await addEdge({
    source_type: 'user', source_id: userId,
    relation: 'saved', target_type: 'intent', target_id: intentId,
    weight: 0.8,
  }, supabase);

  if (district) {
    await addEdge({
      source_type: 'user', source_id: userId,
      relation: 'interested_in', target_type: 'district', target_id: district,
      weight: 0.6,
    }, supabase);
  }
}

// ═══════════════════════════════════════════════════════
// Graph Queries
// ═══════════════════════════════════════════════════════

export interface SimilarUser {
  userId: string;
  overlapCount: number;
  sharedDistricts: string[];
  reason: string;
}

export async function findSimilarUsers(userId: string, supabase: SupabaseClient): Promise<SimilarUser[]> {
  // Find users interested in same districts
  const { data: myInterests } = await supabase
    .from('knowledge_edges')
    .select('target_id')
    .eq('source_type', 'user')
    .eq('source_id', userId)
    .eq('relation', 'interested_in');

  if (!myInterests || myInterests.length === 0) return [];

  const districts = myInterests.map((e) => e.target_id);

  const { data: others } = await supabase
    .from('knowledge_edges')
    .select('source_id, target_id')
    .eq('source_type', 'user')
    .eq('relation', 'interested_in')
    .in('target_id', districts)
    .neq('source_id', userId);

  if (!others) return [];

  const userMap = new Map<string, string[]>();
  for (const e of others) {
    if (!userMap.has(e.source_id)) userMap.set(e.source_id, []);
    userMap.get(e.source_id)!.push(e.target_id);
  }

  return Array.from(userMap.entries())
    .map(([uid, shared]) => ({
      userId: uid,
      overlapCount: shared.length,
      sharedDistricts: shared,
      reason: `Cùng quan tâm ${shared.join(', ')}`,
    }))
    .sort((a, b) => b.overlapCount - a.overlapCount)
    .slice(0, 10);
}

export interface DistrictHeat {
  district: string;
  canCount: number;
  coCount: number;
  totalInterest: number;
  heatLevel: 'cold' | 'warm' | 'hot' | 'very_hot';
}

export async function getHotDistricts(supabase: SupabaseClient): Promise<DistrictHeat[]> {
  const { data: edges } = await supabase
    .from('knowledge_edges')
    .select('target_id, source_type, relation')
    .eq('target_type', 'district');

  if (!edges) return [];

  const districtMap = new Map<string, { can: number; co: number; interest: number }>();
  for (const e of edges) {
    if (!districtMap.has(e.target_id)) districtMap.set(e.target_id, { can: 0, co: 0, interest: 0 });
    const d = districtMap.get(e.target_id)!;
    if (e.relation === 'in_district') {
      d.can++; // simplified
    }
    d.interest++;
  }

  return Array.from(districtMap.entries())
    .map(([district, data]) => ({
      district,
      canCount: data.can,
      coCount: Math.max(1, Math.floor(data.can / 2)),
      totalInterest: data.interest,
      heatLevel: data.interest > 10 ? 'very_hot' as const : data.interest > 5 ? 'hot' as const : data.interest > 2 ? 'warm' as const : 'cold' as const,
    }))
    .sort((a, b) => b.totalInterest - a.totalInterest);
}
