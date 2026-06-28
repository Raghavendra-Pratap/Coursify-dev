import { createServerClient as createServiceClient } from '@/lib/supabase-admin';

export type NotificationPreferenceKey =
  | 'notify_course_updates'
  | 'notify_question_answers'
  | 'notify_new_questions'
  | 'notify_enrollments';

export type NotificationPreferencesRow = {
  user_id: string;
  notify_course_updates: boolean;
  notify_question_answers: boolean;
  notify_new_questions: boolean;
  notify_enrollments: boolean;
  updated_at?: string;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<NotificationPreferencesRow, 'user_id' | 'updated_at'> = {
  notify_course_updates: true,
  notify_question_answers: true,
  notify_new_questions: true,
  notify_enrollments: true,
};

export function createDefaultPreferences(userId: string): NotificationPreferencesRow {
  return { user_id: userId, ...DEFAULT_NOTIFICATION_PREFERENCES };
}

export async function getNotificationPreferencesMap(
  userIds: string[]
): Promise<Map<string, NotificationPreferencesRow>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<string, NotificationPreferencesRow>();
  if (ids.length === 0) return map;

  for (const id of ids) {
    map.set(id, createDefaultPreferences(id));
  }

  try {
    const db = createServiceClient() as any;
    const { data, error } = await db
      .from('user_notification_preferences')
      .select('user_id, notify_course_updates, notify_question_answers, notify_new_questions, notify_enrollments, updated_at')
      .in('user_id', ids);
    if (error || !Array.isArray(data)) return map;

    for (const row of data as NotificationPreferencesRow[]) {
      map.set(row.user_id, {
        user_id: row.user_id,
        notify_course_updates: row.notify_course_updates ?? true,
        notify_question_answers: row.notify_question_answers ?? true,
        notify_new_questions: row.notify_new_questions ?? true,
        notify_enrollments: row.notify_enrollments ?? true,
        updated_at: row.updated_at,
      });
    }
  } catch {
    // fall back to defaults if table/config is missing.
  }

  return map;
}
