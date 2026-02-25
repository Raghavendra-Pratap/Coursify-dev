/**
 * Self-learning preference loop – record activity and update preferences.
 * Shared schema with root (learner_activity, learner_preferences). Uses local Supabase client.
 */
import { createClient } from './supabase-client';

export type ContentType = 'video' | 'reading' | 'quiz' | 'form';
export type ActivityAction = 'completed' | 'viewed' | 'skipped' | 'started';

export interface LearnerActivityRow {
  user_id: string;
  content_type: ContentType;
  entity_type: 'lesson' | 'content_item';
  entity_id: string;
  action: ActivityAction;
  time_spent_seconds?: number;
}

const ACTIVITY_WINDOW_DAYS = 30;
const LEARNING_RATE = 0.15;

const DEFAULT_PREFERENCES = {
  content_video_weight: 0.33,
  content_reading_weight: 0.33,
  content_quiz_weight: 0.34,
  pace_score: 0.5,
};

/**
 * Record one activity event and update preferences from recent activity.
 */
export async function recordActivity(userId: string, row: LearnerActivityRow): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !userId) return;
  const db = createClient();
  await (db as any).from('learner_activity').insert({
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
 * Recompute learner_preferences from recent learner_activity.
 */
export async function updatePreferencesFromActivity(userId: string): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !userId) return;
  const db = createClient();
  const since = new Date();
  since.setDate(since.getDate() - ACTIVITY_WINDOW_DAYS);

  const { data: rows, error } = await (db as any)
    .from('learner_activity')
    .select('content_type, action, time_spent_seconds')
    .eq('user_id', userId)
    .gte('created_at', since.toISOString());

  if (error || !rows?.length) return;

  const completedByType: Record<ContentType, number> = { video: 0, reading: 0, quiz: 0, form: 0 };
  const skippedByType: Record<ContentType, number> = { video: 0, reading: 0, quiz: 0, form: 0 };
  let totalTime = 0;

  for (const r of rows as { content_type: ContentType; action: string; time_spent_seconds?: number }[]) {
    const t = r.content_type as ContentType;
    if (!completedByType[t]) continue;
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

  const { data: existing } = await (db as any)
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

  await (db as any).from('learner_preferences').upsert({
    user_id: userId,
    content_video_weight: videoW,
    content_reading_weight: readingW,
    content_quiz_weight: quizW,
    pace_score: Math.max(0, Math.min(1, paceScore)),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}
