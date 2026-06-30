/** Instructor + learner shell views persisted in the URL (?view=…) and localStorage. */

export const APP_NAV_STORAGE_KEY = 'coursify_app_nav';

const PERSISTED_VIEWS = new Set([
  'dashboard',
  'courses',
  'create',
  'learners',
  'analytics',
  'reports',
  'qa',
  'notes',
  'take',
  'profile',
  'settings',
]);

export type AppNavState = {
  view: string;
  courseId: string | null;
  lessonId: string | null;
};

export function readAppNavFromUrl(): AppNavState | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  if (!view || !PERSISTED_VIEWS.has(view)) return null;
  return {
    view,
    courseId: params.get('course'),
    lessonId: params.get('lesson'),
  };
}

export function readAppNavFromStorage(): AppNavState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(APP_NAV_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppNavState;
    if (!parsed?.view || !PERSISTED_VIEWS.has(parsed.view)) return null;
    return {
      view: parsed.view,
      courseId: parsed.courseId ?? null,
      lessonId: parsed.lessonId ?? null,
    };
  } catch {
    return null;
  }
}

export function writeAppNavToStorage(state: AppNavState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(APP_NAV_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

/** Write ?view=…&course=…&lesson=… without a full navigation (refresh-safe). */
export function syncAppNavToUrl(state: AppNavState): void {
  if (typeof window === 'undefined') return;
  if (!PERSISTED_VIEWS.has(state.view)) return;

  const params = new URLSearchParams(window.location.search);
  params.set('view', state.view);

  if (state.view === 'take' && state.courseId) {
    params.set('course', state.courseId);
    if (state.lessonId) params.set('lesson', state.lessonId);
    else params.delete('lesson');
  } else if (state.view === 'create') {
    if (state.courseId) params.set('course', state.courseId);
    else params.delete('course');
    params.delete('lesson');
  } else {
    params.delete('course');
    params.delete('lesson');
  }

  const search = params.toString();
  const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
  window.history.replaceState({}, '', url);
}

export function buildAppNavState(
  view: string,
  editingCourseId: string | null,
  learningCourseId: string | null,
  learningLessonId: string | null,
): AppNavState {
  if (view === 'create') {
    return { view, courseId: editingCourseId, lessonId: null };
  }
  if (view === 'take') {
    return { view, courseId: learningCourseId, lessonId: learningLessonId };
  }
  return { view, courseId: null, lessonId: null };
}
