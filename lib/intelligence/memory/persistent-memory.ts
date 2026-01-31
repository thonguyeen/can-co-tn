// ═══════════════════════════════════════════════════════════════
// PERSISTENT MEMORY SYSTEM
// ═══════════════════════════════════════════════════════════════
//
// Long-term memory for user context and preferences
//

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic();

export type MemoryType =
  | 'fact'           // User stated facts (name, job, location)
  | 'preference'     // Preferences (likes, dislikes)
  | 'interest'       // Topics they care about
  | 'interaction'    // Notable interactions
  | 'context'        // Conversation context
  | 'behavior'       // Observed behavior patterns
  | 'relationship'   // Relationship with bots
  | 'goal';          // User goals/objectives

export interface Memory {
  id: string;
  userId: string;
  type: MemoryType;
  content: string;
  metadata: Record<string, unknown>;
  importance: number;     // 1-10
  confidence: number;     // 0-1
  source: string;         // Where this was learned
  createdAt: string;
  lastAccessedAt: string;
  accessCount: number;
  expiresAt?: string;     // Optional expiration
}

export interface MemoryQuery {
  userId: string;
  types?: MemoryType[];
  keywords?: string[];
  minImportance?: number;
  limit?: number;
}

// ═══════════════════════════════════════════════════════════════
// MEMORY STORAGE
// ═══════════════════════════════════════════════════════════════

export async function storeMemory(
  userId: string,
  type: MemoryType,
  content: string,
  metadata: Record<string, unknown> = {},
  options: {
    importance?: number;
    confidence?: number;
    source?: string;
    expiresIn?: number; // hours
  } = {}
): Promise<Memory> {
  const now = new Date();

  // Check for duplicate/similar memory
  const existing = await findSimilarMemory(userId, content);
  if (existing) {
    // Update existing memory instead of creating duplicate
    return await reinforceMemory(existing.id);
  }

  const memory: Partial<Memory> = {
    userId,
    type,
    content,
    metadata,
    importance: options.importance || calculateImportance(type, content),
    confidence: options.confidence || 0.8,
    source: options.source || 'conversation',
    createdAt: now.toISOString(),
    lastAccessedAt: now.toISOString(),
    accessCount: 1,
  };

  if (options.expiresIn) {
    memory.expiresAt = new Date(now.getTime() + options.expiresIn * 60 * 60 * 1000).toISOString();
  }

  const { data, error } = await supabase
    .from('user_memories')
    .insert({
      user_id: memory.userId,
      type: memory.type,
      content: memory.content,
      metadata: memory.metadata,
      importance: memory.importance,
      confidence: memory.confidence,
      source: memory.source,
      created_at: memory.createdAt,
      last_accessed_at: memory.lastAccessedAt,
      access_count: memory.accessCount,
      expires_at: memory.expiresAt,
    })
    .select()
    .single();

  if (error) throw error;

  return mapToMemory(data);
}

export async function queryMemories(query: MemoryQuery): Promise<Memory[]> {
  let dbQuery = supabase
    .from('user_memories')
    .select('*')
    .eq('user_id', query.userId)
    .order('importance', { ascending: false })
    .order('last_accessed_at', { ascending: false });

  if (query.types && query.types.length > 0) {
    dbQuery = dbQuery.in('type', query.types);
  }

  if (query.minImportance) {
    dbQuery = dbQuery.gte('importance', query.minImportance);
  }

  if (query.limit) {
    dbQuery = dbQuery.limit(query.limit);
  }

  const { data } = await dbQuery;

  let memories = (data || []).filter(m => {
    // Filter expired
    if (m.expires_at && new Date(m.expires_at) < new Date()) {
      return false;
    }
    return true;
  });

  // Keyword filtering (if provided)
  if (query.keywords && query.keywords.length > 0) {
    const keywordLower = query.keywords.map(k => k.toLowerCase());
    memories = memories.filter(m =>
      keywordLower.some(k => m.content.toLowerCase().includes(k))
    );
  }

  // Update access stats
  if (memories.length > 0) {
    const ids = memories.map(m => m.id);
    await supabase
      .from('user_memories')
      .update({
        last_accessed_at: new Date().toISOString(),
      })
      .in('id', ids);
  }

  return memories.map(mapToMemory);
}

export async function getRelevantMemories(
  userId: string,
  context: string,
  limit: number = 10
): Promise<Memory[]> {
  // Get all memories for user
  const { data: allMemories } = await supabase
    .from('user_memories')
    .select('*')
    .eq('user_id', userId);

  if (!allMemories || allMemories.length === 0) {
    return [];
  }

  // Filter expired
  const validMemories = allMemories.filter(m => {
    if (m.expires_at && new Date(m.expires_at) < new Date()) {
      return false;
    }
    return true;
  });

  if (validMemories.length === 0) return [];

  // Use AI to find relevant memories
  const memorySummaries = validMemories.map(m =>
    `[${m.id}] ${m.type}: ${m.content}`
  ).join('\n');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Given this conversation context:
"${context}"

Which of these memories are relevant? Return only the IDs, comma-separated, most relevant first. Max ${limit}.

Memories:
${memorySummaries}

IDs (comma-separated):`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const relevantIds = text.split(',').map(id => id.trim().replace(/[\[\]]/g, ''));

    return validMemories
      .filter(m => relevantIds.includes(m.id))
      .sort((a, b) => relevantIds.indexOf(a.id) - relevantIds.indexOf(b.id))
      .slice(0, limit)
      .map(mapToMemory);

  } catch (error) {
    // Fallback: return recent important memories
    return validMemories
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit)
      .map(mapToMemory);
  }
}

// ═══════════════════════════════════════════════════════════════
// MEMORY EXTRACTION FROM CONVERSATION
// ═══════════════════════════════════════════════════════════════

export async function extractMemoriesFromConversation(
  userId: string,
  conversation: { role: 'user' | 'assistant'; content: string }[],
  source: string
): Promise<Memory[]> {
  const conversationText = conversation
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Extract memorable facts, preferences, and interests from this conversation.
Only extract information explicitly stated or strongly implied by the USER.
Do NOT extract information about the assistant.

Conversation:
${conversationText}

Respond in JSON array format:
[
  {
    "type": "fact|preference|interest|goal",
    "content": "Clear statement of what was learned",
    "importance": 1-10,
    "confidence": 0.5-1.0
  }
]

If nothing notable to remember, return empty array [].
JSON:`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const extracted = JSON.parse(jsonMatch[0]);
    const memories: Memory[] = [];

    for (const item of extracted) {
      if (item.content && item.type) {
        const memory = await storeMemory(
          userId,
          item.type,
          item.content,
          { extractedFrom: 'conversation' },
          {
            importance: item.importance,
            confidence: item.confidence,
            source,
          }
        );
        memories.push(memory);
      }
    }

    return memories;

  } catch (error) {
    console.error('Memory extraction error:', error);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

async function findSimilarMemory(userId: string, content: string): Promise<Memory | null> {
  const { data } = await supabase
    .from('user_memories')
    .select('*')
    .eq('user_id', userId);

  if (!data || data.length === 0) return null;

  // Check similarity threshold
  const contentLower = content.toLowerCase();
  const similar = data.find(m => {
    const memoryLower = m.content.toLowerCase();
    const similarity = calculateSimilarity(contentLower, memoryLower);
    return similarity > 0.7;
  });

  return similar ? mapToMemory(similar) : null;
}

async function reinforceMemory(memoryId: string): Promise<Memory> {
  const { data: current } = await supabase
    .from('user_memories')
    .select('*')
    .eq('id', memoryId)
    .single();

  if (!current) throw new Error('Memory not found');

  const { data } = await supabase
    .from('user_memories')
    .update({
      access_count: current.access_count + 1,
      confidence: Math.min(1.0, current.confidence + 0.05),
      last_accessed_at: new Date().toISOString(),
    })
    .eq('id', memoryId)
    .select()
    .single();

  return mapToMemory(data);
}

function calculateImportance(type: MemoryType, content: string): number {
  const typeWeights: Record<MemoryType, number> = {
    fact: 7,
    preference: 8,
    interest: 8,
    goal: 9,
    relationship: 6,
    behavior: 5,
    interaction: 4,
    context: 3,
  };

  let importance = typeWeights[type] || 5;

  // Boost for certain keywords
  const importantKeywords = ['always', 'never', 'love', 'hate', 'important', 'need', 'must'];
  if (importantKeywords.some(k => content.toLowerCase().includes(k))) {
    importance = Math.min(10, importance + 1);
  }

  return importance;
}

function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));
  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;
  return union > 0 ? intersection / union : 0;
}

function mapToMemory(data: Record<string, unknown>): Memory {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    type: data.type as MemoryType,
    content: data.content as string,
    metadata: (data.metadata || {}) as Record<string, unknown>,
    importance: data.importance as number,
    confidence: data.confidence as number,
    source: data.source as string,
    createdAt: data.created_at as string,
    lastAccessedAt: data.last_accessed_at as string,
    accessCount: data.access_count as number,
    expiresAt: data.expires_at as string | undefined,
  };
}

// ═══════════════════════════════════════════════════════════════
// MEMORY MANAGEMENT
// ═══════════════════════════════════════════════════════════════

export async function deleteMemory(memoryId: string): Promise<void> {
  await supabase.from('user_memories').delete().eq('id', memoryId);
}

export async function deleteAllUserMemories(userId: string): Promise<void> {
  await supabase.from('user_memories').delete().eq('user_id', userId);
}

export async function getUserMemorySummary(userId: string): Promise<{
  totalMemories: number;
  byType: Record<MemoryType, number>;
  oldestMemory: string | null;
  newestMemory: string | null;
}> {
  const { data, count } = await supabase
    .from('user_memories')
    .select('type, created_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  const byType: Record<string, number> = {};
  (data || []).forEach(m => {
    byType[m.type] = (byType[m.type] || 0) + 1;
  });

  return {
    totalMemories: count || 0,
    byType: byType as Record<MemoryType, number>,
    oldestMemory: data?.[0]?.created_at || null,
    newestMemory: data?.[data.length - 1]?.created_at || null,
  };
}
