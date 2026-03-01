/**
 * Self-learning preference loop for Coursify LMS.
 *
 * Loop: Record activity → Update preferences from activity → Use preferences for ordering/recommendations.
 *
 * - Activity: completed/viewed/skipped events per content type (video, reading, quiz, form).
 * - Preferences: weights for video/reading/quiz (and pace) inferred from activity.
 * - Use: score content or courses by fit to preferences for "Recommended for you" or ordering.
 */

import { supabase } from '@/lib/supabase';

export type ContentType = 'video' | 'reading' | 'quiz' | 'form';
export type ActivityAction = 'completed' | 'viewed' | 'skipped' | 'started';

export interface LearnerPreferences {
  user_id: string;
  content_video_weight: number;
  content_reading_weight: number;
  content_quiz_weight: number;
  pace_score: number;
  updated_at: string;
}

export interface LearnerActivityRow {
  user_id: string;
  content_type: ContentType;
  entity_type: 'lesson' | 'content_item';
  entity_id: string;
  action: ActivityAction;
  time_spent_seconds?: number;
}

const DEFAULT_PREFERENCES: Omit<LearnerPreferences, 'user_id' | 'updated_at'> = {
  content_video_weight: 0.33,
  content_reading_weight: 0.33,
  content_quiz_weight: 0.34,
  pace_score: 0.5,
};

/** Number of recent activity rows to consider when updating preferences */
const ACTIVITY_WINDOW_DAYS = 30;
/** How much to move weights per completion (smoothing) */
const LEARNING_RATE = 0.15;

/**
 * Get current preferences for a user. Returns defaults if none stored.
 */
export async function getPreferences(userId: string): Promise<LearnerPreferences | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !userId) return null;
  const db = supabase as any;
  const { data, error } = await db
    .from('learner_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) {
    return {
      user_id: userId,
      ...DEFAULT_PREFERENCES,
      updated_at: new Date().toISOString(),
    } as LearnerPreferences;
  }
  return data as LearnerPreferences;
}

/**
 * Record one activity event (e.g. completed a video, skipped reading).
 * Call this when the learner completes/views/skips content.
 */
export async function recordActivity(userId: string, row: LearnerActivityRow): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !userId) return;
  const db = supabase as any;
  await db.from('learner_activity').insert({
    user_id: userId,
    content_type: row.content_type,
    entity_type: row.entity_type ?? 'lesson',
    entity_id: row.entity_id,
    action: row.action,
    time_spent_seconds: row.time_spent_seconds ?? 0,
  });
  await updatePreferencesFromActivity(userId);
}

/**
 * Update learner_preferences from recent learner_activity (self-learning step).
 * Increases weight for content types the user completes often and decreases for skipped.
 */
export async function updatePreferencesFromActivity(userId: string): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !userId) return;
  const db = supabase as any;

  const since = new Date();
  since.setDate(since.getDate() - ACTIVITY_WINDOW_DAYS);

  const { data: rows, error } = await db
    .from('learner_activity')
    .select('content_type, action, time_spent_seconds')
    .eq('user_id', userId)
    .gte('created_at', since.toISOString());

  if (error || !rows?.length) return;

  const completedByType: Record<ContentType, number> = {
    video: 0,
    reading: 0,
    quiz: 0,
    form: 0,
  };
  const skippedByType: Record<ContentType, number> = {
    video: 0,
    reading: 0,
    quiz: 0,
    form: 0,
  };
  let totalTime = 0;

  for (const r of rows as { content_type: ContentType; action: string; time_spent_seconds?: number }[]) {
    const t = r.content_type as ContentType;
    if (!(t in completedByType)) continue;
    if (r.action === 'completed' || r.action === 'viewed') {
      completedByType[t]++;
      totalTime += r.time_spent_seconds ?? 0;
    } else if (r.action === 'skipped') {
      skippedByType[t]++;
    }
  }

  const totalCompleted = Object.values(completedByType).reduce((a, b) => a + b, 0);
  const totalSkipped = Object.values(skippedByType).reduce((a, b) => a + b, 0);
  if (totalCompleted + totalSkipped === 0) return;

  const { data: existing } = await db
    .from('learner_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  let videoW = existing?.content_video_weight ?? DEFAULT_PREFERENCES.content_video_weight;
  let readingW = existing?.content_reading_weight ?? DEFAULT_PREFERENCES.content_reading_weight;
  let quizW = existing?.content_quiz_weight ?? DEFAULT_PREFERENCES.content_quiz_weight;

  const types: ContentType[] = ['video', 'reading', 'quiz', 'form'];
  for (const t of types) {
    const completed = completedByType[t];
    const skipped = skippedByType[t];
    const delta = (completed - skipped) / Math.max(totalCompleted + totalSkipped, 1);
    const change = LEARNING_RATE * delta;
    if (t === 'video') videoW = Math.max(0.05, Math.min(0.9, videoW + change));
    if (t === 'reading') readingW = Math.max(0.05, Math.min(0.9, readingW + change));
    if (t === 'quiz' || t === 'form') quizW = Math.max(0.05, Math.min(0.9, quizW + change));
  }

  const sum = videoW + readingW + quizW;
  videoW = videoW / sum;
  readingW = readingW / sum;
  quizW = quizW / sum;

  const paceScore = totalTime > 0 && rows.length > 0
    ? Math.min(1, (totalTime / rows.length) / 600)
    : (existing?.pace_score ?? DEFAULT_PREFERENCES.pace_score);

  await db.from('learner_preferences').upsert({
    user_id: userId,
    content_video_weight: videoW,
    content_reading_weight: readingW,
    content_quiz_weight: quizW,
    pace_score: Math.max(0, Math.min(1, paceScore)),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

/**
 * Score a content type by how well it matches the user's preferences (for ordering or "Recommended").
 * Higher = better match.
 */
export function getContentRecommendationScore(
  contentType: ContentType,
  preferences: LearnerPreferences | null
): number {
  if (!preferences) return 0.5;
  const map: Record<ContentType, number> = {
    video: preferences.content_video_weight,
    reading: preferences.content_reading_weight,
    quiz: preferences.content_quiz_weight,
    form: preferences.content_quiz_weight,
  };
  return map[contentType] ?? 0.5;
}

/**
 * Score a course by how well its content mix fits the user's preferences.
 * contentMix: { video: number, reading: number, quiz: number } (counts or ratios).
 */
export function getCourseRecommendationScore(
  contentMix: { video?: number; reading?: number; quiz?: number },
  preferences: LearnerPreferences | null
): number {
  if (!preferences) return 0.5;
  const total = (contentMix.video ?? 0) + (contentMix.reading ?? 0) + (contentMix.quiz ?? 0);
  if (total === 0) return 0.5;
  const score =
    ((contentMix.video ?? 0) / total) * preferences.content_video_weight +
    ((contentMix.reading ?? 0) / total) * preferences.content_reading_weight +
    ((contentMix.quiz ?? 0) / total) * preferences.content_quiz_weight;
  return Math.round(score * 100) / 100;
}
