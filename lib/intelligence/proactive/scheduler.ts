// ═══════════════════════════════════════════════════════════════
// PROACTIVE SCHEDULER
// ═══════════════════════════════════════════════════════════════
//
// Scheduled tasks for proactive intelligence
//

import { generateOutreachCandidates, executeOutreach } from './outreach-engine';
import { applyInterestDecay } from '../interests/interest-tracker';
import { decayNotificationFatigue } from './notification-timing';
import { evaluateTriggers, executeTriggerAlert } from '../alerts/custom-triggers';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface SchedulerResult {
  task: string;
  success: boolean;
  processed: number;
  errors: string[];
  duration: number;
}

// ═══════════════════════════════════════════════════════════════
// HOURLY TASKS
// ═══════════════════════════════════════════════════════════════

export async function runHourlyProactiveTasks(): Promise<SchedulerResult[]> {
  const results: SchedulerResult[] = [];

  // 1. Generate and execute outreach
  const outreachResult = await runOutreachTask();
  results.push(outreachResult);

  // 2. Evaluate triggers for recent content
  const triggerResult = await runTriggerEvaluationTask();
  results.push(triggerResult);

  return results;
}

async function runOutreachTask(): Promise<SchedulerResult> {
  const start = Date.now();
  const errors: string[] = [];
  let processed = 0;

  try {
    const candidates = await generateOutreachCandidates(20);

    for (const candidate of candidates.slice(0, 10)) { // Max 10 per hour
      try {
        const result = await executeOutreach(candidate);
        if (result.success) processed++;
        else if (result.error) errors.push(`${candidate.userId}: ${result.error}`);
      } catch (error) {
        errors.push(`${candidate.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      task: 'proactive_outreach',
      success: true,
      processed,
      errors,
      duration: Date.now() - start,
    };

  } catch (error) {
    return {
      task: 'proactive_outreach',
      success: false,
      processed,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      duration: Date.now() - start,
    };
  }
}

async function runTriggerEvaluationTask(): Promise<SchedulerResult> {
  const start = Date.now();
  const errors: string[] = [];
  let processed = 0;

  try {
    // Get recent posts as context
    const { data: recentPosts } = await supabase
      .from('posts')
      .select('id, content, created_at')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    for (const post of recentPosts || []) {
      const evaluations = await evaluateTriggers({
        content: post.content,
        postId: post.id,
        timestamp: post.created_at,
      });

      for (const evaluation of evaluations) {
        try {
          await executeTriggerAlert(evaluation);
          processed++;
        } catch (error) {
          errors.push(`Trigger ${evaluation.triggerId}: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }
    }

    return {
      task: 'trigger_evaluation',
      success: true,
      processed,
      errors,
      duration: Date.now() - start,
    };

  } catch (error) {
    return {
      task: 'trigger_evaluation',
      success: false,
      processed,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      duration: Date.now() - start,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// DAILY TASKS
// ═══════════════════════════════════════════════════════════════

export async function runDailyMaintenanceTasks(): Promise<SchedulerResult[]> {
  const results: SchedulerResult[] = [];

  // 1. Decay interest scores
  const interestResult = await runInterestDecayTask();
  results.push(interestResult);

  // 2. Decay notification fatigue
  const fatigueResult = await runFatigueDecayTask();
  results.push(fatigueResult);

  // 3. Clean up expired memories
  const memoryResult = await runMemoryCleanupTask();
  results.push(memoryResult);

  return results;
}

async function runInterestDecayTask(): Promise<SchedulerResult> {
  const start = Date.now();

  try {
    const processed = await applyInterestDecay();

    return {
      task: 'interest_decay',
      success: true,
      processed,
      errors: [],
      duration: Date.now() - start,
    };

  } catch (error) {
    return {
      task: 'interest_decay',
      success: false,
      processed: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      duration: Date.now() - start,
    };
  }
}

async function runFatigueDecayTask(): Promise<SchedulerResult> {
  const start = Date.now();

  try {
    const processed = await decayNotificationFatigue();

    return {
      task: 'fatigue_decay',
      success: true,
      processed,
      errors: [],
      duration: Date.now() - start,
    };

  } catch (error) {
    return {
      task: 'fatigue_decay',
      success: false,
      processed: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      duration: Date.now() - start,
    };
  }
}

async function runMemoryCleanupTask(): Promise<SchedulerResult> {
  const start = Date.now();

  try {
    // Delete expired memories
    const { count } = await supabase
      .from('user_memories')
      .delete({ count: 'exact' })
      .lt('expires_at', new Date().toISOString());

    return {
      task: 'memory_cleanup',
      success: true,
      processed: count || 0,
      errors: [],
      duration: Date.now() - start,
    };

  } catch (error) {
    return {
      task: 'memory_cleanup',
      success: false,
      processed: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      duration: Date.now() - start,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// WEEKLY TASKS
// ═══════════════════════════════════════════════════════════════

export async function runWeeklyAnalyticsTasks(): Promise<SchedulerResult[]> {
  const results: SchedulerResult[] = [];

  // Generate weekly interest insights
  const insightsResult = await runWeeklyInsightsTask();
  results.push(insightsResult);

  return results;
}

async function runWeeklyInsightsTask(): Promise<SchedulerResult> {
  const start = Date.now();
  let processed = 0;

  try {
    // Get users with significant activity
    const { data: activeUsers } = await supabase
      .from('user_interests')
      .select('user_id')
      .gte('last_interaction_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .gte('score', 30);

    const uniqueUsers = [...new Set((activeUsers || []).map(u => u.user_id))];

    // For each user, generate and optionally send insights
    for (const userId of uniqueUsers.slice(0, 100)) {
      try {
        // Get user's interest trends
        const { data: interests } = await supabase
          .from('user_interests')
          .select('topic, score, trend')
          .eq('user_id', userId)
          .order('score', { ascending: false })
          .limit(5);

        if (interests && interests.length > 0) {
          // Store weekly insight
          await supabase.from('user_insights').insert({
            user_id: userId,
            type: 'weekly_summary',
            data: {
              topInterests: interests,
              generatedAt: new Date().toISOString(),
            },
          });
          processed++;
        }
      } catch (error) {
        console.error(`Failed to generate insights for ${userId}:`, error);
      }
    }

    return {
      task: 'weekly_insights',
      success: true,
      processed,
      errors: [],
      duration: Date.now() - start,
    };

  } catch (error) {
    return {
      task: 'weekly_insights',
      success: false,
      processed,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      duration: Date.now() - start,
    };
  }
}
