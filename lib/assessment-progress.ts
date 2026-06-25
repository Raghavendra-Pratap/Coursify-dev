/**
 * Sync learner progress after Assessment Pro webhook or manual grading.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export async function syncAssessmentProgress(
  db: SupabaseClient,
  opts: {
    enrollmentId: string;
    contentItemId: string;
    score: number;
    passed: boolean;
    markLessonComplete?: boolean;
  }
): Promise<void> {
  const { enrollmentId, contentItemId, score, passed, markLessonComplete = passed } = opts;

  const { data: contentItem } = await db
    .from('content_items')
    .select('lesson_id')
    .eq('id', contentItemId)
    .single();

  if (!contentItem) return;
  const lessonId = (contentItem as { lesson_id: string }).lesson_id;

  const { data: progressRow } = await db
    .from('progress')
    .select('id, completed')
    .eq('enrollment_id', enrollmentId)
    .eq('lesson_id', lessonId)
    .maybeSingle();

  const progressPayload: Record<string, unknown> = {
    last_accessed_at: new Date().toISOString(),
  };
  if (markLessonComplete && passed) {
    progressPayload.completed = true;
    progressPayload.completed_at = new Date().toISOString();
  }

  if (progressRow) {
    await db.from('progress').update(progressPayload).eq('enrollment_id', enrollmentId).eq('lesson_id', lessonId);
  } else {
    await db.from('progress').insert({
      enrollment_id: enrollmentId,
      lesson_id: lessonId,
      ...progressPayload,
    });
  }
}
