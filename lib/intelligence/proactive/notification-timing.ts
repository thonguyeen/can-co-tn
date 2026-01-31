// ═══════════════════════════════════════════════════════════════
// SMART NOTIFICATION TIMING
// ═══════════════════════════════════════════════════════════════
//
// AI-powered optimal notification timing per user
//

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface NotificationDecision {
  canNotify: boolean;
  reason: string;
  optimalTime?: string;
  urgencyOverride?: boolean;
}

export interface UserActivityPattern {
  userId: string;
  hourlyActivity: number[];      // 24 hours, activity score 0-100
  preferredHours: number[];      // Best hours to reach
  quietHours: { start: number; end: number };
  timezone: string;
  lastNotificationAt: string | null;
  notificationFatigue: number;   // 0-100, higher = more fatigued
  responseRate: number;          // 0-1, rate of responding to notifications
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION DECISION
// ═══════════════════════════════════════════════════════════════

export async function shouldNotifyUser(
  userId: string,
  urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): Promise<NotificationDecision> {
  const pattern = await getUserActivityPattern(userId);
  const currentHour = new Date().getHours();

  // Check quiet hours
  if (isQuietHours(currentHour, pattern.quietHours)) {
    if (urgency !== 'critical') {
      return {
        canNotify: false,
        reason: 'Quiet hours',
        optimalTime: getNextActiveTime(pattern),
      };
    }
  }

  // Check notification fatigue
  if (pattern.notificationFatigue > 80 && urgency !== 'critical') {
    return {
      canNotify: false,
      reason: 'High notification fatigue',
      optimalTime: getNextActiveTime(pattern),
    };
  }

  // Check recent notification (cooldown)
  if (pattern.lastNotificationAt) {
    const hoursSinceLastNotification =
      (Date.now() - new Date(pattern.lastNotificationAt).getTime()) / (1000 * 60 * 60);

    const cooldownHours = getCooldownHours(urgency, pattern.notificationFatigue);

    if (hoursSinceLastNotification < cooldownHours) {
      const remaining = cooldownHours - hoursSinceLastNotification;
      return {
        canNotify: false,
        reason: `Cooldown period (${remaining.toFixed(1)}h remaining)`,
        optimalTime: new Date(Date.now() + remaining * 60 * 60 * 1000).toISOString(),
      };
    }
  }

  // Check if current hour is good
  if (pattern.preferredHours.includes(currentHour)) {
    return { canNotify: true, reason: 'Preferred hour' };
  }

  // Check if activity is acceptable
  if (pattern.hourlyActivity[currentHour] >= 30) {
    return { canNotify: true, reason: 'Active hour' };
  }

  // For high/critical urgency, notify anyway
  if (urgency === 'high' || urgency === 'critical') {
    return { canNotify: true, reason: 'Urgency override', urgencyOverride: true };
  }

  return {
    canNotify: false,
    reason: 'Low activity hour',
    optimalTime: getNextActiveTime(pattern),
  };
}

export async function getOptimalNotificationTime(
  userId: string,
  preferredTimeframe: 'morning' | 'afternoon' | 'evening' | 'any' = 'any'
): Promise<string> {
  const pattern = await getUserActivityPattern(userId);

  const timeframeHours: Record<string, number[]> = {
    morning: [7, 8, 9, 10, 11],
    afternoon: [12, 13, 14, 15, 16, 17],
    evening: [18, 19, 20, 21, 22],
    any: Array.from({ length: 24 }, (_, i) => i),
  };

  const eligibleHours = timeframeHours[preferredTimeframe]
    .filter(h => !isQuietHours(h, pattern.quietHours))
    .sort((a, b) => pattern.hourlyActivity[b] - pattern.hourlyActivity[a]);

  const optimalHour = eligibleHours[0] || pattern.preferredHours[0] || 9;

  const now = new Date();
  const optimalTime = new Date(now);
  optimalTime.setHours(optimalHour, 0, 0, 0);

  // If optimal time has passed today, schedule for tomorrow
  if (optimalTime <= now) {
    optimalTime.setDate(optimalTime.getDate() + 1);
  }

  return optimalTime.toISOString();
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITY PATTERN TRACKING
// ═══════════════════════════════════════════════════════════════

export async function recordUserActivity(
  userId: string,
  _channel: string
): Promise<void> {
  const currentHour = new Date().getHours();

  // Get or create activity pattern
  const { data: existing } = await supabase
    .from('user_activity_patterns')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing) {
    const hourlyActivity = existing.hourly_activity || new Array(24).fill(0);
    hourlyActivity[currentHour] = Math.min(100, (hourlyActivity[currentHour] || 0) + 5);

    await supabase
      .from('user_activity_patterns')
      .update({
        hourly_activity: hourlyActivity,
        last_activity_at: new Date().toISOString(),
        activity_count: existing.activity_count + 1,
      })
      .eq('user_id', userId);
  } else {
    const hourlyActivity = new Array(24).fill(0);
    hourlyActivity[currentHour] = 10;

    await supabase
      .from('user_activity_patterns')
      .insert({
        user_id: userId,
        hourly_activity: hourlyActivity,
        preferred_hours: [currentHour],
        quiet_hours: { start: 23, end: 7 },
        timezone: 'Asia/Ho_Chi_Minh',
        notification_fatigue: 0,
        response_rate: 0.5,
        activity_count: 1,
        last_activity_at: new Date().toISOString(),
      });
  }
}

export async function recordNotificationSent(
  userId: string,
  wasResponded: boolean
): Promise<void> {
  const { data: pattern } = await supabase
    .from('user_activity_patterns')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!pattern) return;

  // Update fatigue and response rate
  const newFatigue = Math.min(100, pattern.notification_fatigue + (wasResponded ? 0 : 10));
  const newResponseRate = (pattern.response_rate * 0.9) + (wasResponded ? 0.1 : 0);

  await supabase
    .from('user_activity_patterns')
    .update({
      last_notification_at: new Date().toISOString(),
      notification_fatigue: newFatigue,
      response_rate: newResponseRate,
      notifications_sent: (pattern.notifications_sent || 0) + 1,
      notifications_responded: (pattern.notifications_responded || 0) + (wasResponded ? 1 : 0),
    })
    .eq('user_id', userId);
}

export async function decayNotificationFatigue(): Promise<number> {
  // Decay fatigue for all users (run daily)
  const { data } = await supabase
    .from('user_activity_patterns')
    .select('id, notification_fatigue')
    .gt('notification_fatigue', 0);

  if (!data) return 0;

  for (const pattern of data) {
    await supabase
      .from('user_activity_patterns')
      .update({
        notification_fatigue: Math.max(0, pattern.notification_fatigue - 10),
      })
      .eq('id', pattern.id);
  }

  return data.length;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

async function getUserActivityPattern(userId: string): Promise<UserActivityPattern> {
  const { data } = await supabase
    .from('user_activity_patterns')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (data) {
    return {
      userId: data.user_id,
      hourlyActivity: data.hourly_activity || new Array(24).fill(20),
      preferredHours: data.preferred_hours || [9, 12, 19],
      quietHours: data.quiet_hours || { start: 23, end: 7 },
      timezone: data.timezone || 'Asia/Ho_Chi_Minh',
      lastNotificationAt: data.last_notification_at,
      notificationFatigue: data.notification_fatigue || 0,
      responseRate: data.response_rate || 0.5,
    };
  }

  // Default pattern for new users
  return {
    userId,
    hourlyActivity: [
      5, 5, 5, 5, 5, 10,      // 0-5: Night
      20, 40, 60, 70, 70, 60, // 6-11: Morning
      70, 60, 50, 50, 50, 60, // 12-17: Afternoon
      70, 80, 70, 50, 30, 10, // 18-23: Evening
    ],
    preferredHours: [9, 12, 19, 20],
    quietHours: { start: 23, end: 7 },
    timezone: 'Asia/Ho_Chi_Minh',
    lastNotificationAt: null,
    notificationFatigue: 0,
    responseRate: 0.5,
  };
}

function isQuietHours(hour: number, quietHours: { start: number; end: number }): boolean {
  if (quietHours.start < quietHours.end) {
    return hour >= quietHours.start && hour < quietHours.end;
  }
  // Handles overnight quiet hours (e.g., 23-7)
  return hour >= quietHours.start || hour < quietHours.end;
}

function getCooldownHours(urgency: string, fatigue: number): number {
  const baseCooldown: Record<string, number> = {
    low: 24,
    medium: 8,
    high: 2,
    critical: 0.5,
  };

  // Increase cooldown based on fatigue
  const fatigueMultiplier = 1 + (fatigue / 100);

  return baseCooldown[urgency] * fatigueMultiplier;
}

function getNextActiveTime(pattern: UserActivityPattern): string {
  const now = new Date();
  const currentHour = now.getHours();

  // Find next preferred hour
  let nextHour = pattern.preferredHours.find(h => h > currentHour);

  if (!nextHour) {
    // Next day, first preferred hour
    nextHour = pattern.preferredHours[0];
    now.setDate(now.getDate() + 1);
  }

  now.setHours(nextHour, 0, 0, 0);
  return now.toISOString();
}
