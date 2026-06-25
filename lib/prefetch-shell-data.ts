import { fetchJsonCached, SHELL_CACHE_MS } from './client-fetch-cache';

const opts = { maxAgeMs: SHELL_CACHE_MS };

export function prefetchInstructorShell(userId?: string | null) {
  void fetchJsonCached('instructor:dashboard:7days', '/api/instructor/dashboard?period=7days', opts);
  void fetchJsonCached('instructor:my-courses', '/api/instructor/my-courses', opts);
  void fetchJsonCached('instructor:learners', '/api/instructor/learners', opts);
  void fetchJsonCached('instructor:analytics', '/api/instructor/analytics', opts);
  void fetchJsonCached('instructor:questions', '/api/instructor/questions', opts);
  void fetchJsonCached('notification-preferences', '/api/notification-preferences', opts);
  if (userId) void fetchJsonCached(`notifications:${userId}`, '/api/notifications', { maxAgeMs: 30_000 });
}

export function prefetchLearnerShell(userId?: string | null) {
  void fetchJsonCached('learning:enrolled', '/api/learning/enrolled', opts);
  void fetchJsonCached('learning:my-questions', '/api/learning/my-questions', opts);
  void fetchJsonCached('notification-preferences', '/api/notification-preferences', opts);
  if (userId) {
    void fetchJsonCached(`learning:notes:${userId}`, '/api/learning/notes', opts);
    void fetchJsonCached(`notifications:${userId}`, '/api/notifications', { maxAgeMs: 30_000 });
  }
}

export function prefetchShellData(mode: 'instructor' | 'learner', userId?: string | null) {
  if (mode === 'instructor') prefetchInstructorShell(userId);
  else prefetchLearnerShell(userId);
}

/** Warm cache for a single nav target (hover / focus). */
export function prefetchShellView(
  view: string,
  mode: 'instructor' | 'learner' | null,
  userId?: string | null
) {
  if (!mode) return;
  switch (view) {
    case 'dashboard':
      if (mode === 'instructor') {
        void fetchJsonCached('instructor:dashboard:7days', '/api/instructor/dashboard?period=7days', opts);
      }
      break;
    case 'courses':
      if (mode === 'instructor') {
        void fetchJsonCached('instructor:my-courses', '/api/instructor/my-courses', opts);
      } else {
        void fetchJsonCached('learning:enrolled', '/api/learning/enrolled', opts);
      }
      break;
    case 'learners':
      void fetchJsonCached('instructor:learners', '/api/instructor/learners', opts);
      break;
    case 'analytics':
      void fetchJsonCached('instructor:analytics', '/api/instructor/analytics', opts);
      break;
    case 'notes':
      if (userId) void fetchJsonCached(`learning:notes:${userId}`, '/api/learning/notes', opts);
      break;
    case 'qa':
      if (mode === 'instructor') {
        void fetchJsonCached('instructor:questions', '/api/instructor/questions', opts);
      } else {
        void fetchJsonCached('learning:my-questions', '/api/learning/my-questions', opts);
      }
      break;
    case 'settings':
      void fetchJsonCached('notification-preferences', '/api/notification-preferences', opts);
      break;
    default:
      break;
  }
}
