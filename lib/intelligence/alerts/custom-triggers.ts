// ═══════════════════════════════════════════════════════════════
// CUSTOM ALERT TRIGGERS
// ═══════════════════════════════════════════════════════════════
//
// User-defined alert conditions with complex logic
//

import { createClient } from '@supabase/supabase-js';
import { getOpenClawClient } from '@/lib/openclaw/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type TriggerType =
  | 'keyword'           // Keyword match in news
  | 'price'             // Price threshold
  | 'sentiment'         // Sentiment change
  | 'volume'            // Activity volume
  | 'entity_mention'    // Specific entity mentioned
  | 'category_news'     // News in category
  | 'bot_post'          // Specific bot posts
  | 'prediction_close'  // Prediction about to close
  | 'custom';           // Custom condition

export type TriggerOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'changes_by';

export interface AlertTrigger {
  id: string;
  userId: string;
  name: string;
  description: string;
  type: TriggerType;
  conditions: TriggerCondition[];
  logic: 'and' | 'or';
  isActive: boolean;
  channel?: string;
  cooldownMinutes: number;
  lastTriggeredAt?: string;
  triggerCount: number;
  createdAt: string;
}

export interface TriggerCondition {
  field: string;
  operator: TriggerOperator;
  value: unknown;
  metadata?: Record<string, unknown>;
}

export interface TriggerEvaluation {
  triggered: boolean;
  triggerId: string;
  matchedConditions: number;
  context: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════
// TRIGGER MANAGEMENT
// ═══════════════════════════════════════════════════════════════

export async function createTrigger(
  userId: string,
  trigger: Omit<AlertTrigger, 'id' | 'userId' | 'triggerCount' | 'createdAt'>
): Promise<AlertTrigger> {
  const { data, error } = await supabase
    .from('alert_triggers')
    .insert({
      user_id: userId,
      name: trigger.name,
      description: trigger.description,
      type: trigger.type,
      conditions: trigger.conditions,
      logic: trigger.logic || 'and',
      is_active: trigger.isActive ?? true,
      channel: trigger.channel,
      cooldown_minutes: trigger.cooldownMinutes || 60,
      trigger_count: 0,
    })
    .select()
    .single();

  if (error) throw error;

  return mapToAlertTrigger(data);
}

export async function getUserTriggers(userId: string): Promise<AlertTrigger[]> {
  const { data } = await supabase
    .from('alert_triggers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return (data || []).map(mapToAlertTrigger);
}

export async function toggleTrigger(triggerId: string, isActive: boolean): Promise<void> {
  await supabase
    .from('alert_triggers')
    .update({ is_active: isActive })
    .eq('id', triggerId);
}

export async function deleteTrigger(triggerId: string): Promise<void> {
  await supabase
    .from('alert_triggers')
    .delete()
    .eq('id', triggerId);
}

// ═══════════════════════════════════════════════════════════════
// TRIGGER EVALUATION
// ═══════════════════════════════════════════════════════════════

export async function evaluateTriggers(
  context: Record<string, unknown>
): Promise<TriggerEvaluation[]> {
  // Get all active triggers
  const { data: triggers } = await supabase
    .from('alert_triggers')
    .select('*')
    .eq('is_active', true);

  if (!triggers || triggers.length === 0) return [];

  const evaluations: TriggerEvaluation[] = [];

  for (const trigger of triggers) {
    const evaluation = evaluateTrigger(mapToAlertTrigger(trigger), context);

    if (evaluation.triggered) {
      // Check cooldown
      if (trigger.last_triggered_at) {
        const minutesSinceLast =
          (Date.now() - new Date(trigger.last_triggered_at).getTime()) / (1000 * 60);

        if (minutesSinceLast < trigger.cooldown_minutes) {
          continue; // Still in cooldown
        }
      }

      evaluations.push(evaluation);

      // Update trigger stats
      await supabase
        .from('alert_triggers')
        .update({
          last_triggered_at: new Date().toISOString(),
          trigger_count: trigger.trigger_count + 1,
        })
        .eq('id', trigger.id);
    }
  }

  return evaluations;
}

function evaluateTrigger(
  trigger: AlertTrigger,
  context: Record<string, unknown>
): TriggerEvaluation {
  const results = trigger.conditions.map(condition =>
    evaluateCondition(condition, context)
  );

  const triggered = trigger.logic === 'and'
    ? results.every(r => r)
    : results.some(r => r);

  return {
    triggered,
    triggerId: trigger.id,
    matchedConditions: results.filter(r => r).length,
    context,
  };
}

function evaluateCondition(
  condition: TriggerCondition,
  context: Record<string, unknown>
): boolean {
  const fieldValue = getNestedValue(context, condition.field);

  if (fieldValue === undefined) return false;

  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value;

    case 'not_equals':
      return fieldValue !== condition.value;

    case 'contains':
      if (typeof fieldValue === 'string') {
        return fieldValue.toLowerCase().includes(String(condition.value).toLowerCase());
      }
      return false;

    case 'not_contains':
      if (typeof fieldValue === 'string') {
        return !fieldValue.toLowerCase().includes(String(condition.value).toLowerCase());
      }
      return true;

    case 'greater_than':
      return Number(fieldValue) > Number(condition.value);

    case 'less_than':
      return Number(fieldValue) < Number(condition.value);

    case 'between': {
      const [min, max] = condition.value as [number, number];
      const num = Number(fieldValue);
      return num >= min && num <= max;
    }

    case 'changes_by': {
      // Requires previous value in context
      const previousValue = context[`${condition.field}_previous`];
      if (previousValue === undefined) return false;
      const changePercent = ((Number(fieldValue) - Number(previousValue)) / Number(previousValue)) * 100;
      return Math.abs(changePercent) >= Number(condition.value);
    }

    default:
      return false;
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: unknown, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// ═══════════════════════════════════════════════════════════════
// TRIGGER EXECUTION
// ═══════════════════════════════════════════════════════════════

export async function executeTriggerAlert(
  evaluation: TriggerEvaluation
): Promise<void> {
  const { data: trigger } = await supabase
    .from('alert_triggers')
    .select('*')
    .eq('id', evaluation.triggerId)
    .single();

  if (!trigger) return;

  // Get user's channel
  const { data: channel } = await supabase
    .from('user_channels')
    .select('channel, channel_id, preferences')
    .eq('user_id', trigger.user_id)
    .eq('is_primary', true)
    .maybeSingle();

  if (!channel) return;

  const client = getOpenClawClient();

  const message = formatTriggerAlert(mapToAlertTrigger(trigger), evaluation);

  await client.send({
    channel: channel.channel,
    recipient: channel.channel_id,
    content: message,
  });

  // Log alert
  await supabase.from('trigger_alerts').insert({
    trigger_id: evaluation.triggerId,
    user_id: trigger.user_id,
    context: evaluation.context,
    channel: channel.channel,
  });
}

function formatTriggerAlert(
  trigger: AlertTrigger,
  evaluation: TriggerEvaluation
): string {
  return `🔔 *Alert: ${trigger.name}*

${trigger.description}

Triggered by: ${evaluation.matchedConditions}/${trigger.conditions.length} conditions matched

---
Manage: \`alerts\` | Mute: \`alerts mute ${trigger.id.slice(0, 6)}\``;
}

// ═══════════════════════════════════════════════════════════════
// PRESET TRIGGERS
// ═══════════════════════════════════════════════════════════════

export const PRESET_TRIGGERS: Omit<AlertTrigger, 'id' | 'userId' | 'triggerCount' | 'createdAt'>[] = [
  {
    name: 'GPT-5 News',
    description: 'Alert khi có tin về GPT-5',
    type: 'keyword',
    conditions: [
      { field: 'content', operator: 'contains', value: 'GPT-5' },
    ],
    logic: 'and',
    isActive: true,
    cooldownMinutes: 60,
  },
  {
    name: 'AI Regulation',
    description: 'Tin về luật AI',
    type: 'keyword',
    conditions: [
      { field: 'content', operator: 'contains', value: 'AI regulation' },
      { field: 'content', operator: 'contains', value: 'AI law' },
    ],
    logic: 'or',
    isActive: true,
    cooldownMinutes: 120,
  },
  {
    name: 'Major Hack',
    description: 'Tin về hack/breach lớn',
    type: 'keyword',
    conditions: [
      { field: 'content', operator: 'contains', value: 'breach' },
      { field: 'content', operator: 'contains', value: 'hack' },
      { field: 'breakingLevel', operator: 'equals', value: 'critical' },
    ],
    logic: 'and',
    isActive: true,
    cooldownMinutes: 30,
  },
  {
    name: 'Bitcoin Breaking',
    description: 'Tin nóng về Bitcoin',
    type: 'keyword',
    conditions: [
      { field: 'content', operator: 'contains', value: 'bitcoin' },
      { field: 'isBreaking', operator: 'equals', value: true },
    ],
    logic: 'and',
    isActive: true,
    cooldownMinutes: 60,
  },
  {
    name: 'Vietnam Tech',
    description: 'Tin công nghệ Việt Nam',
    type: 'keyword',
    conditions: [
      { field: 'content', operator: 'contains', value: 'Vietnam' },
      { field: 'content', operator: 'contains', value: 'Việt Nam' },
    ],
    logic: 'or',
    isActive: true,
    cooldownMinutes: 120,
  },
];

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function mapToAlertTrigger(data: Record<string, unknown>): AlertTrigger {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    name: data.name as string,
    description: data.description as string,
    type: data.type as TriggerType,
    conditions: data.conditions as TriggerCondition[],
    logic: data.logic as 'and' | 'or',
    isActive: data.is_active as boolean,
    channel: data.channel as string | undefined,
    cooldownMinutes: data.cooldown_minutes as number,
    lastTriggeredAt: data.last_triggered_at as string | undefined,
    triggerCount: data.trigger_count as number,
    createdAt: data.created_at as string,
  };
}
