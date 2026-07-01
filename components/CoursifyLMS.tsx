'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Play, Upload, Edit, Users, BarChart3, Settings, Plus, Check, X, Clock, FileText, Video, Folder, ChevronRight, ChevronDown, Menu, Search, Bell, Award, TrendingUp, Home, BookOpen, Zap, Eye, Share2, Download, Target, Mail, User, LogOut, StickyNote, HelpCircle, LayoutList, FileSpreadsheet, Youtube } from 'lucide-react';
import BrandLogo, { NavBrand } from '@/components/BrandLogo';
import { ThemeAvatar, ThemeStatCard } from '@/components/ui/ThemeStatCard';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import AccountSettings from './pages/AccountSettings';
import MyLearning from './pages/MyLearning';
import MyCourses from './pages/MyCourses';
import Learners from './pages/Learners';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import MyNotes from './pages/MyNotes';
import QAndA from './pages/QAndA';
import NotificationsDropdown from './NotificationsDropdown';
import { MfaChallengePanel } from '@/components/MfaChallengePanel';
import { getPrimaryVerifiedFactorId, needsMfaChallenge } from '@/lib/mfa';
import { prefetchShellData, prefetchShellView } from '@/lib/prefetch-shell-data';
import {
  buildAppNavState,
  readAppNavFromStorage,
  readAppNavFromUrl,
  syncAppNavToUrl,
  writeAppNavToStorage,
  type AppNavState,
} from '@/lib/app-nav-url';
import { replaceBrowserUrl } from '@/lib/browser-url';
import { loginPath } from '@/lib/site-urls';
import { inputValueFromEvent } from '@/lib/dom-event';
import {
  defaultViewForMode,
  detectLandingIntentFromLocation,
  isSessionMode,
  persistSessionMode,
  resolveSessionModeForUser,
  stashLandingIntent,
  type SessionMode,
} from '@/lib/session-mode';

function KeepAliveView({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div className={active ? '' : 'hidden'} aria-hidden={!active}>
      {children}
    </div>
  );
}

type SessionModeOrNull = SessionMode | null;

function applyPersistedNav(
  nav: AppNavState,
  setters: {
    setCurrentView: (view: string) => void;
    setEditingCourseId: (id: string | null) => void;
    setLearningCourseId: (id: string | null) => void;
    setLearningLessonId: (id: string | null) => void;
  },
) {
  setters.setCurrentView(nav.view);
  if (nav.view === 'create') {
    setters.setEditingCourseId(nav.courseId);
    setters.setLearningCourseId(null);
    setters.setLearningLessonId(null);
    return;
  }
  if (nav.view === 'take' && nav.courseId) {
    setters.setLearningCourseId(nav.courseId);
    setters.setLearningLessonId(nav.lessonId);
    setters.setEditingCourseId(null);
    return;
  }
  setters.setEditingCourseId(null);
  if (nav.view !== 'take') {
    setters.setLearningCourseId(null);
    setters.setLearningLessonId(null);
  }
}

const pageLoading = () => (
  <div className="flex min-h-[60vh] items-center justify-center p-8">
    <div className="animate-pulse text-content-muted">Loading…</div>
  </div>
);

const CreateCourse = dynamic(() => import('./pages/CreateCourse'), { loading: pageLoading, ssr: false });
const TakeCourse = dynamic(() => import('./pages/TakeCourse'), { loading: pageLoading, ssr: false });

type UserDisplay = { displayName: string; email?: string; initials: string; role?: string };

/** Stable module-level layout so nav changes do not remount TakeCourse / video player. */
function TopNavItem({
  label,
  view,
  currentView,
  onNavigate,
  onAfterNavigate,
  onPrefetch,
}: {
  label: string;
  view: string;
  currentView: string;
  onNavigate: (view: string) => void;
  onAfterNavigate?: () => void;
  onPrefetch?: (view: string) => void;
}) {
  const active = currentView === view;
  return (
    <button
      type="button"
      onClick={() => {
        onNavigate(view);
        onAfterNavigate?.();
      }}
      onMouseEnter={() => onPrefetch?.(view)}
      onFocus={() => onPrefetch?.(view)}
      className={`c-nav-tab${active ? ' active' : ''}`}
    >
      {active ? <span className="c-nav-tab-dot" aria-hidden /> : null}
      <span>{label}</span>
    </button>
  );
}

type CreateEditorNavActions = {
  openImportYouTube: () => void;
  openImportSheet: () => void;
  openOrganize: () => void;
};

const courseEditorPillBtn =
  'flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-brand/30 bg-brand/10 text-sm font-semibold text-brand hover:bg-brand/20 transition-colors disabled:opacity-50';
const courseEditorPillBtnRed =
  'flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-sm font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50';
const courseEditorPillBtnSheet =
  'flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[#34A853]/45 bg-[#34A853]/12 text-sm font-semibold text-[#34A853] hover:bg-[#34A853]/22 transition-colors disabled:opacity-50';

function CreateCourseNav({
  onBackToCourses,
  editorActions,
  onAfterNavigate,
  stacked = false,
}: {
  onBackToCourses: () => void;
  editorActions: CreateEditorNavActions | null;
  onAfterNavigate?: () => void;
  stacked?: boolean;
}) {
  const backBtn = (
    <button
      type="button"
      onClick={() => {
        onBackToCourses();
        onAfterNavigate?.();
      }}
      className={courseEditorPillBtn}
    >
      <ChevronRight className="w-4 h-4 rotate-180 flex-shrink-0" />
      <span>Back to Courses</span>
    </button>
  );

  const organizeBtn = (
    <button
      type="button"
      disabled={!editorActions}
      onClick={() => {
        editorActions?.openOrganize();
        onAfterNavigate?.();
      }}
      className={courseEditorPillBtn}
    >
      <LayoutList className="w-4 h-4 flex-shrink-0" />
      <span>Organize structure</span>
    </button>
  );

  const importBtns = (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold text-content-secondary whitespace-nowrap">Import :</span>
      <button
        type="button"
        disabled={!editorActions}
        onClick={() => {
          editorActions?.openImportYouTube();
          onAfterNavigate?.();
        }}
        className={courseEditorPillBtnRed}
        title="Import from YouTube"
      >
        <Youtube className="w-4 h-4 flex-shrink-0" />
        <span>YouTube</span>
      </button>
      <button
        type="button"
        disabled={!editorActions}
        onClick={() => {
          editorActions?.openImportSheet();
          onAfterNavigate?.();
        }}
        className={courseEditorPillBtnSheet}
        title="Import from Google Sheet"
      >
        <FileSpreadsheet className="w-4 h-4 flex-shrink-0" />
        <span>Sheet</span>
      </button>
    </div>
  );

  if (stacked) {
    return (
      <div className="flex flex-col gap-2 w-full">
        {backBtn}
        {organizeBtn}
        <div className="flex flex-col sm:flex-row gap-2">{importBtns}</div>
      </div>
    );
  }

  return (
    <div className="w-full flex items-center gap-3 min-h-[40px]">
      <div className="flex-shrink-0">{backBtn}</div>
      <div className="flex-1 flex justify-center min-w-0">{organizeBtn}</div>
      <div className="flex-shrink-0 ml-auto">{importBtns}</div>
    </div>
  );
}

function CoursifyAppLayout({
  currentView,
  sessionMode,
  userDisplay,
  onShowSignIn,
  onShowProfile,
  onNavigate,
  onOpenCourse,
  onOpenSettings,
  onPrefetchView,
  onBackToCourses,
  createEditorActions,
  children,
}: {
  currentView: string;
  sessionMode: SessionMode;
  userDisplay: UserDisplay;
  onShowSignIn: () => void;
  onShowProfile: () => void;
  onNavigate: (view: string) => void;
  onOpenCourse?: (courseId: string) => void;
  onOpenSettings: () => void;
  onPrefetchView?: (view: string) => void;
  onBackToCourses?: () => void;
  createEditorActions?: CreateEditorNavActions | null;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isTakeView = currentView === 'take';

  const learnerNav = (
    <>
      <TopNavItem label="My Learning" view="courses" currentView={currentView} onNavigate={onNavigate} onAfterNavigate={() => setMobileNavOpen(false)} onPrefetch={onPrefetchView} />
      <TopNavItem label="My Notes" view="notes" currentView={currentView} onNavigate={onNavigate} onAfterNavigate={() => setMobileNavOpen(false)} onPrefetch={onPrefetchView} />
      <TopNavItem label="Q & A" view="qa" currentView={currentView} onNavigate={onNavigate} onAfterNavigate={() => setMobileNavOpen(false)} onPrefetch={onPrefetchView} />
    </>
  );

  const instructorNav = (
    <>
      <TopNavItem label="Dashboard" view="dashboard" currentView={currentView} onNavigate={onNavigate} onAfterNavigate={() => setMobileNavOpen(false)} onPrefetch={onPrefetchView} />
      <TopNavItem label="My Courses" view="courses" currentView={currentView} onNavigate={onNavigate} onAfterNavigate={() => setMobileNavOpen(false)} onPrefetch={onPrefetchView} />
      <TopNavItem label="Learners" view="learners" currentView={currentView} onNavigate={onNavigate} onAfterNavigate={() => setMobileNavOpen(false)} onPrefetch={onPrefetchView} />
      <TopNavItem label="Analytics" view="analytics" currentView={currentView} onNavigate={onNavigate} onAfterNavigate={() => setMobileNavOpen(false)} onPrefetch={onPrefetchView} />
      <TopNavItem label="Reports" view="reports" currentView={currentView} onNavigate={onNavigate} onAfterNavigate={() => setMobileNavOpen(false)} onPrefetch={onPrefetchView} />
      <TopNavItem label="Q & A" view="qa" currentView={currentView} onNavigate={onNavigate} onAfterNavigate={() => setMobileNavOpen(false)} onPrefetch={onPrefetchView} />
    </>
  );

  const navItems = sessionMode === 'learner' ? learnerNav : instructorNav;
  const isCreateView = currentView === 'create';
  const showStandardNav = !isCreateView;
  const showCreateNav = isCreateView && !isTakeView;

  const headerUserActions = (
    <>
      {userDisplay.role === 'Sign in to save' ? (
        <button
          type="button"
          onClick={onShowSignIn}
          className="px-4 py-2 btn-brand text-sm"
        >
          Sign In
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={onShowProfile}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-raised transition-colors"
            title={userDisplay.displayName}
          >
            <ThemeAvatar initials={userDisplay.initials} className="w-8 h-8 text-xs" />
            <div className="hidden md:block text-left min-w-0">
              <p className="text-sm font-semibold text-content truncate max-w-[120px]">{userDisplay.displayName}</p>
              <p className="text-[11px] text-content-muted truncate">{userDisplay.role}</p>
            </div>
          </button>
          <NotificationsDropdown onOpenCourse={onOpenCourse} onOpenSettings={onOpenSettings} />
        </>
      )}
      <button
        type="button"
        onClick={() => setMobileNavOpen((o) => !o)}
        className="lg:hidden p-2 rounded-lg text-content-secondary hover:bg-raised transition-colors"
        aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileNavOpen}
      >
        {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
    </>
  );

  return (
    <div className="h-screen flex flex-col app-shell" data-view={sessionMode === 'learner' ? 'learner' : 'creator'}>
      <header className="c-nav app-header">
        <div className="c-nav-start">
          <NavBrand />

          {!isTakeView && showCreateNav && onBackToCourses ? (
            <div className="hidden lg:flex flex-1 min-w-0 items-center overflow-visible">
              <CreateCourseNav
                onBackToCourses={onBackToCourses}
                editorActions={createEditorActions ?? null}
              />
            </div>
          ) : !isTakeView && showStandardNav ? (
            <nav className="c-nav-tabs hidden lg:flex ml-1">
              {navItems}
            </nav>
          ) : (
            <div className="flex-1 min-w-0" />
          )}
        </div>

        <div className="c-nav-end">{headerUserActions}</div>
      </header>

      {mobileNavOpen && !isCreateView && (
        <nav className="lg:hidden border-b border-line px-3 py-3 surface-1" style={{ borderColor: 'var(--c-border)' }}>
          {showCreateNav && onBackToCourses ? (
            <CreateCourseNav
              onBackToCourses={onBackToCourses}
              editorActions={createEditorActions ?? null}
              onAfterNavigate={() => setMobileNavOpen(false)}
              stacked
            />
          ) : showStandardNav ? (
            <div className="flex flex-col gap-1 c-nav-tabs c-nav-tabs--stacked [&_.c-nav-tab]:w-full [&_.c-nav-tab]:justify-start">
              {navItems}
            </div>
          ) : null}
        </nav>
      )}

      <main className={`flex-1 min-h-0 bg-canvas ${isTakeView ? 'overflow-hidden flex flex-col' : 'overflow-auto'}`}>
        {children}
      </main>
    </div>
  );
}

const CoursifyLMS = () => {
  const { user, isLoading: authLoading, isAuthenticated, signOut: authSignOut } = useAuth();
  const [sessionMode, setSessionMode] = useState<SessionModeOrNull>(null);
  const [sessionModeResolved, setSessionModeResolved] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signInMfaFactorId, setSignInMfaFactorId] = useState<string | null>(null);
  const [mfaGateFactorId, setMfaGateFactorId] = useState<string | null>(null);
  const [userDisplay, setUserDisplay] = useState<UserDisplay>({ displayName: 'Guest', initials: '—', role: 'Sign in to save' });
  const [profileStats, setProfileStats] = useState({ courses: 0, certificates: 0, badges: 0 });
  const [isRedirectingToGoogle, setIsRedirectingToGoogle] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [createEditorKey, setCreateEditorKey] = useState(0);

  const openNewCourseEditor = useCallback(() => {
    try {
      localStorage.removeItem('create_course_draft_new');
    } catch {
      // ignore storage errors
    }
    setEditingCourseId(null);
    setCreateEditorKey((k) => k + 1);
    setCurrentView('create');
  }, []);
  const [learningCourseId, setLearningCourseId] = useState<string | null>(null);
  const [learningLessonId, setLearningLessonId] = useState<string | null>(null);
  const [createEditorActions, setCreateEditorActions] = useState<CreateEditorNavActions | null>(null);
  const authChecked = !authLoading;
  /** Skip default dashboard/courses restore when URL or storage already set the view */
  const sessionViewRestoredRef = useRef(false);
  const navRestoredRef = useRef(false);
  /** Ref to current view so the auth effect can avoid overwriting Take Course / Create Course when it re-runs (learner + instructor) */
  const currentViewRef = useRef(currentView);
  currentViewRef.current = currentView;

  // Stash ?landing= / ?enroll= from URL; enroll redirects immediately.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const enrollCourseId = params.get('enroll');
    if (enrollCourseId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(enrollCourseId)) {
      stashLandingIntent('learner');
      window.location.replace(`/course/${enrollCourseId}`);
      return;
    }
    const landing = detectLandingIntentFromLocation(window.location.pathname, window.location.search);
    if (landing) stashLandingIntent(landing);
  }, []);

  // Restore shell view after auth is known (guest vs signed-in).
  useEffect(() => {
    if (!authChecked || navRestoredRef.current) return;

    const landing = detectLandingIntentFromLocation(window.location.pathname, window.location.search);

    if (!user && landing) {
      navRestoredRef.current = true;
      const cleanParams = new URLSearchParams(window.location.search);
      if (cleanParams.has('view') || cleanParams.has('course') || cleanParams.has('lesson')) {
        cleanParams.delete('view');
        cleanParams.delete('course');
        cleanParams.delete('lesson');
        const qs = cleanParams.toString();
        replaceBrowserUrl(qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
      }
      return;
    }

    navRestoredRef.current = true;

    if (user && landing) {
      setCurrentView(defaultViewForMode(landing));
      sessionViewRestoredRef.current = true;
      return;
    }

    const nav = readAppNavFromUrl() ?? readAppNavFromStorage();
    if (!nav) return;
    applyPersistedNav(nav, {
      setCurrentView,
      setEditingCourseId,
      setLearningCourseId,
      setLearningLessonId,
    });
    sessionViewRestoredRef.current = true;
  }, [authChecked, user]);

  // Keep ?view=… in the URL and localStorage so refresh returns to the same page (signed-in only).
  useEffect(() => {
    if (!user || !sessionMode) return;
    const nav = buildAppNavState(currentView, editingCourseId, learningCourseId, learningLessonId);
    syncAppNavToUrl(nav);
    writeAppNavToStorage(nav);
  }, [user, sessionMode, currentView, editingCourseId, learningCourseId, learningLessonId]);

  // Notifications are shown in the header dropdown; redirect legacy notifications view.
  useEffect(() => {
    if (currentView === 'notifications') {
      setCurrentView(sessionMode === 'instructor' ? 'dashboard' : 'courses');
    }
  }, [currentView, sessionMode]);

  // Apply saved theme (dark/light) on load. Default is dark; users can switch to light in Settings.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('coursify_account_settings');
      const parsed = raw ? JSON.parse(raw) : null;
      const theme = parsed?.theme === 'light' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.setAttribute('data-mode', theme);
    } catch {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-mode', 'dark');
    }
  }, []);

  // If user landed with ?code=... (e.g. old OAuth redirect to /), exchange code for session and clean URL
  useEffect(() => {
    if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;
    supabase.auth.exchangeCodeForSession(code).then(() => {
      params.delete('code');
      const search = params.toString();
      const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
      replaceBrowserUrl(url);
    }).catch(() => {
      replaceBrowserUrl(window.location.pathname);
    });
  }, []);

  // Sync auth context user -> userDisplay; resolve learner vs instructor landing mode.
  useEffect(() => {
    if (!user) {
      setUserDisplay({ displayName: 'Guest', initials: '—', role: 'Sign in to save' });
      setProfileStats({ courses: 0, certificates: 0, badges: 0 });
      setSessionMode(null);
      setSessionModeResolved(false);
      sessionViewRestoredRef.current = false;
      return;
    }
    const rawName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? (user.email ? user.email.split('@')[0] : null) ?? 'User';
    const name = typeof rawName === 'string' ? rawName : 'User';
    const initials = name.split(/\s+/).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
    setUserDisplay({ displayName: name, email: user.email ?? undefined, initials: initials || 'U', role: 'Learner' });
    supabase.from('user_profiles').select('full_name, role').eq('id', user.id).maybeSingle().then(({ data: profileData }) => {
      if (profileData) {
        const profile = profileData as { full_name: string | null; role: string };
        const displayName = (profile.full_name ?? name) as string;
        const role = profile.role === 'admin' ? 'Admin Account' : profile.role === 'instructor' ? 'Instructor' : 'Learner';
        setUserDisplay((prev) => ({ ...prev, displayName, role }));
      }
    });
    const maybeRestoreView = (mode: SessionMode) => {
      if (sessionViewRestoredRef.current) return;
      const view = currentViewRef.current;
      if (view !== 'dashboard' && view !== 'courses') return;
      sessionViewRestoredRef.current = true;
      setCurrentView(defaultViewForMode(mode));
    };
    let cancelled = false;
    setSessionModeResolved(false);
    (async () => {
      const { count } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (cancelled) return;
      setProfileStats({ courses: count ?? 0, certificates: 0, badges: 0 });

      const { mode, source } = await resolveSessionModeForUser(user);
      if (cancelled) return;
      setSessionMode(mode);
      setSessionModeResolved(true);
      if (mode) {
        if (source === 'landing') {
          setCurrentView(defaultViewForMode(mode));
          sessionViewRestoredRef.current = true;
          if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.has('landing')) {
              params.delete('landing');
              const qs = params.toString();
              replaceBrowserUrl(qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
            }
          }
        } else {
          maybeRestoreView(mode);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user?.id || !sessionMode) return;
    prefetchShellData(sessionMode, user.id);
  }, [user?.id, sessionMode]);

  const handlePrefetchView = useCallback(
    (view: string) => prefetchShellView(view, sessionMode, user?.id ?? null),
    [sessionMode, user?.id]
  );

  // After sign-in: process pending invites (learner landing).
  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const enrollCourseId = params.get('enroll');

      const res = await fetch('/api/invites/process-pending', { method: 'POST', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      const enrolledFromInvites = (data?.enrolled ?? 0) > 0;
      if (enrolledFromInvites) {
        await persistSessionMode('learner', user.id);
        setSessionMode('learner');
        setSessionModeResolved(true);
        setCurrentView('courses');
      }

      if (enrollCourseId) {
        stashLandingIntent('learner');
        const enrollRes = await fetch(`/api/courses/${encodeURIComponent(enrollCourseId)}/enroll`, {
          method: 'POST',
          credentials: 'include',
        });
        if (enrollRes.ok) {
          await persistSessionMode('learner', user.id);
          setSessionMode('learner');
          setSessionModeResolved(true);
          setCurrentView('courses');
        }
        params.delete('enroll');
        const search = params.toString();
        const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
        replaceBrowserUrl(url);
      }
    })();
  }, [user]);

  const handleLogout = async () => {
    setShowProfileModal(false);
    setUserDisplay({ displayName: 'Guest', initials: '—', role: 'Sign in to save' });
    setProfileStats({ courses: 0, certificates: 0, badges: 0 });
    setSignInMfaFactorId(null);
    setMfaGateFactorId(null);
    await authSignOut();
  };

  const applySignedInUser = useCallback(async (signedInUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) => {
    setShowSignInModal(false);
    setSignInEmail('');
    setSignInPassword('');
    setSignInError(null);
    setSignInMfaFactorId(null);
    const name = (signedInUser.user_metadata?.full_name ?? signedInUser.user_metadata?.name ?? signedInUser.email?.split('@')[0] ?? 'User') as string;
    const initials = name.split(/\s+/).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
    setUserDisplay({ displayName: name, email: signedInUser.email ?? undefined, initials, role: 'Learner' });
    const { mode } = await resolveSessionModeForUser(signedInUser);
    setSessionMode(mode);
    setSessionModeResolved(true);
    const persistedNav = readAppNavFromUrl() ?? readAppNavFromStorage();
    if (persistedNav) {
      applyPersistedNav(persistedNav, {
        setCurrentView,
        setEditingCourseId,
        setLearningCourseId,
        setLearningLessonId,
      });
      sessionViewRestoredRef.current = true;
    } else if (mode) setCurrentView(defaultViewForMode(mode));
    supabase.from('user_profiles').select('full_name, role').eq('id', signedInUser.id).maybeSingle().then(({ data: profile }) => {
      if (profile) {
        const displayName = (profile.full_name ?? name) as string;
        const role = profile.role === 'admin' ? 'Admin Account' : profile.role === 'instructor' ? 'Instructor' : 'Learner';
        setUserDisplay((prev) => ({ ...prev, displayName, role }));
      }
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setMfaGateFactorId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const needed = await needsMfaChallenge();
      if (cancelled) return;
      if (!needed) {
        setMfaGateFactorId(null);
        return;
      }
      const factorId = await getPrimaryVerifiedFactorId();
      if (!cancelled && factorId) setMfaGateFactorId(factorId);
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.id]);

  const cancelPendingMfaSignIn = async () => {
    setSignInMfaFactorId(null);
    setSignInError(null);
    await authSignOut();
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError(null);
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setSignInError('Sign-in is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local');
      return;
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: signInEmail.trim(), password: signInPassword });
      if (error) {
        setSignInError(error.message || 'Sign in failed');
        return;
      }
      const signedInUser = data.user ?? data.session?.user;
      if (!signedInUser) return;
      const mfaNeeded = await needsMfaChallenge();
      if (mfaNeeded) {
        const factorId = await getPrimaryVerifiedFactorId();
        if (factorId) {
          setSignInMfaFactorId(factorId);
          return;
        }
      }
      await applySignedInUser(signedInUser);
    } catch (err) {
      setSignInError(err instanceof Error ? err.message : 'Sign in failed');
    }
  };

  const handleSignInWithGoogle = async () => {
    setSignInError(null);
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setSignInError('Sign-in is not configured.');
      return;
    }
    try {
      if (typeof window !== 'undefined') {
        const landing = detectLandingIntentFromLocation(window.location.pathname, window.location.search);
        if (landing) stashLandingIntent(landing);
      }
      const params = new URLSearchParams(window.location.search);
      const nextQuery: Record<string, string> = {};
      const landingParam = params.get('landing');
      if (isSessionMode(landingParam)) nextQuery.landing = landingParam;
      const enroll = params.get('enroll');
      if (enroll) nextQuery.enroll = enroll;
      const nextPath = loginPath(nextQuery);
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
      if (error) {
        setSignInError(error.message || 'Google sign-in failed');
        return;
      }
      if (data?.url && typeof window !== 'undefined') {
        setIsRedirectingToGoogle(true);
        window.location.href = data.url;
        return;
      }
    } catch (err) {
      setSignInError(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  };

  useEffect(() => {
    if (currentView !== 'create') setCreateEditorActions(null);
  }, [currentView]);

  const handleBackToCourses = useCallback(() => {
    setEditingCourseId(null);
    setCurrentView('courses');
  }, []);

  const fallback = null;

  const supabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isGuest = userDisplay.role === 'Sign in to save';
  const requireSignIn = authChecked && isGuest && supabaseConfigured;

  // Don't show the app until we've checked auth (avoids flashing dashboard to guests)
  if (supabaseConfigured && !authChecked) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-6 w-full max-w-sm">
          <BrandLogo size="lg" showTagline linkToHome className="mb-2" />
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-4 border-line" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand animate-spin" />
          </div>
          <p className="text-content-secondary font-medium">Checking sign-in…</p>
          <div className="w-full h-1.5 bg-raised rounded-full overflow-hidden">
            <div className="h-full w-1/4 bg-brand rounded-full animate-load-bar" />
          </div>
        </div>
      </div>
    );
  }

  if (supabaseConfigured && user && authChecked && !sessionModeResolved) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-6 w-full max-w-sm">
          <BrandLogo size="lg" />
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-4 border-line" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand animate-spin" />
          </div>
          <p className="text-content-secondary font-medium">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  const needsSessionMode = !requireSignIn && authChecked && sessionModeResolved && sessionMode === null && supabaseConfigured && !!user;

  if (needsSessionMode) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <div className="app-card rounded-xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="flex justify-center mb-6">
            <BrandLogo size="lg" showTagline linkToHome />
          </div>
          <h1 className="text-xl font-semibold text-content mb-2">Welcome</h1>
          <p className="text-content-secondary mb-8 text-sm">Choose how you want to use the app. You can switch anytime from your profile.</p>
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => {
                void persistSessionMode('instructor', user?.id).then(() => {
                  setSessionMode('instructor');
                  setCurrentView('dashboard');
                });
              }}
              className="w-full py-4 px-6 rounded-md border border-brand/40 bg-brand-subtle text-brand font-medium hover:bg-brand/20 transition-colors flex items-center justify-center gap-3 tracking-wide text-sm uppercase"
            >
              <Video className="w-5 h-5" />
              Open as Instructor
            </button>
            <button
              type="button"
              onClick={() => {
                void persistSessionMode('learner', user?.id).then(() => {
                  setSessionMode('learner');
                  setCurrentView('courses');
                });
              }}
              className="w-full py-4 px-6 rounded-md btn-secondary flex items-center justify-center gap-3 tracking-wide text-sm uppercase"
            >
              <BookOpen className="w-5 h-5" />
              Open as Learner
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mfaGateFactorId) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <div className="app-card rounded-xl shadow-xl max-w-md w-full p-6">
          <div className="flex justify-center mb-6">
            <BrandLogo size="lg" showTagline linkToHome />
          </div>
          <MfaChallengePanel
            factorId={mfaGateFactorId}
            onSuccess={() => setMfaGateFactorId(null)}
            onCancel={async () => {
              setMfaGateFactorId(null);
              await authSignOut();
            }}
          />
        </div>
      </div>
    );
  }

  const mfaSignInSuccess = async () => {
    const { data: { user: signedInUser } } = await supabase.auth.getUser();
    if (signedInUser) await applySignedInUser(signedInUser);
  };

  if (requireSignIn) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <div className="app-card rounded-xl shadow-xl max-w-md w-full p-6">
          <div className="flex justify-center mb-6">
            <BrandLogo size="lg" showTagline linkToHome />
          </div>
          <h1 className="text-xl font-semibold text-content mb-2 text-center">Sign in</h1>
          <p className="text-content-secondary mb-6 text-sm text-center">Access your dashboard and courses.</p>
          {signInMfaFactorId ? (
            <MfaChallengePanel
              factorId={signInMfaFactorId}
              onSuccess={mfaSignInSuccess}
              onCancel={cancelPendingMfaSignIn}
            />
          ) : (
          <form onSubmit={handleSignIn} className="space-y-4">
            {signInError && (
              <div className="p-3 bg-danger-subtle border border-danger/30 rounded-md text-sm text-danger">{signInError}</div>
            )}
            <div>
              <label className="block text-xs font-medium text-content-secondary uppercase tracking-wider mb-1.5">Email</label>
              <input type="email" value={signInEmail} onChange={(e) => setSignInEmail(inputValueFromEvent(e))} placeholder="you@example.com" className="app-input" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-secondary uppercase tracking-wider mb-1.5">Password</label>
              <input type="password" value={signInPassword} onChange={(e) => setSignInPassword(inputValueFromEvent(e))} placeholder="••••••••" className="app-input" required />
            </div>
            <button type="submit" className="w-full flex justify-center items-center c-btn c-btn-primary py-3 tracking-wide uppercase text-sm">Sign In</button>
            <button type="button" onClick={handleSignInWithGoogle} disabled={isRedirectingToGoogle} className="w-full flex justify-center items-center c-btn c-btn-ghost py-3 gap-2 disabled:opacity-60 disabled:pointer-events-none tracking-wide uppercase text-sm">
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              {isRedirectingToGoogle ? 'Redirecting…' : 'Sign in with Google'}
            </button>
          </form>
          )}
        </div>
      </div>
    );
  }

  if (!sessionMode) return null;

  return (
    <CoursifyAppLayout
      currentView={currentView}
      sessionMode={sessionMode}
      userDisplay={userDisplay}
      onShowSignIn={() => { setShowSignInModal(true); setShowProfileModal(false); }}
      onShowProfile={() => setShowProfileModal(true)}
      onNavigate={setCurrentView}
      onOpenCourse={(id) => {
        setLearningLessonId(null);
        setLearningCourseId(id);
        setCurrentView('take');
      }}
      onOpenSettings={() => setCurrentView('settings')}
      onPrefetchView={handlePrefetchView}
      onBackToCourses={handleBackToCourses}
      createEditorActions={currentView === 'create' ? createEditorActions : null}
    >
      <KeepAliveView active={currentView === 'dashboard'}>
        <Dashboard setCurrentView={setCurrentView} />
      </KeepAliveView>
      <KeepAliveView active={currentView === 'courses'}>
        <MyCourses
          setCurrentView={setCurrentView}
          listActive={currentView === 'courses'}
          onCreateCourse={openNewCourseEditor}
          onEditCourse={(id) => { setEditingCourseId(id); setCreateEditorKey((k) => k + 1); setCurrentView('create'); }}
          onStartCourse={(id) => { setLearningLessonId(null); setLearningCourseId(id); setCurrentView('take'); }}
          sessionMode={sessionMode}
          learningCourseId={learningCourseId}
        />
      </KeepAliveView>
      {currentView === 'create' && (CreateCourse != null ? (
        <CreateCourse
          key={`create-${createEditorKey}-${editingCourseId ?? 'new'}`}
          setCurrentView={setCurrentView}
          initialCourseId={editingCourseId}
          onBackToCourses={handleBackToCourses}
          onImportSuccess={(id) => { setEditingCourseId(id); setCreateEditorKey((k) => k + 1); setCurrentView('create'); }}
          onCourseSaved={(id) => setEditingCourseId(id)}
          onRegisterEditorActions={setCreateEditorActions}
        />
      ) : fallback)}
      {currentView === 'take' && learningCourseId && (TakeCourse != null ? <TakeCourse courseId={learningCourseId} onBack={() => { setLearningCourseId(null); setLearningLessonId(null); setCurrentView('courses'); }} initialLessonId={learningLessonId} /> : fallback)}
      <KeepAliveView active={currentView === 'notes'}>
        <MyNotes setCurrentView={setCurrentView} onStartCourse={(id) => { setLearningLessonId(null); setLearningCourseId(id); setCurrentView('take'); }} onOpenLesson={(courseId, lessonId) => { setLearningCourseId(courseId); setLearningLessonId(lessonId); setCurrentView('take'); }} />
      </KeepAliveView>
      <KeepAliveView active={currentView === 'qa'}>
        <QAndA setCurrentView={setCurrentView} sessionMode={sessionMode} onStartCourse={(id) => { setLearningCourseId(id); setCurrentView('take'); }} />
      </KeepAliveView>
      <KeepAliveView active={currentView === 'learners'}>
        <Learners setCurrentView={setCurrentView} />
      </KeepAliveView>
      <KeepAliveView active={currentView === 'analytics'}>
        <Analytics setCurrentView={setCurrentView} />
      </KeepAliveView>
      <KeepAliveView active={currentView === 'reports'}>
        <Reports />
      </KeepAliveView>
      <KeepAliveView active={currentView === 'profile'}>
        <Profile setCurrentView={setCurrentView} />
      </KeepAliveView>
      <KeepAliveView active={currentView === 'settings'}>
        <AccountSettings />
      </KeepAliveView>

      {/* Sign In Modal */}
      {showSignInModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowSignInModal(false); setSignInError(null); }}>
          <div className="app-card rounded-lg shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-line flex items-center justify-between">
              <h3 className="text-xl font-semibold text-content">Sign In</h3>
              <button 
                onClick={() => { setShowSignInModal(false); setSignInError(null); }}
                className="p-2 hover:bg-overlay rounded-lg transition-all text-content-secondary"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSignIn} className="p-6">
              {signInMfaFactorId ? (
                <MfaChallengePanel
                  factorId={signInMfaFactorId}
                  onSuccess={mfaSignInSuccess}
                  onCancel={cancelPendingMfaSignIn}
                />
              ) : (
              <>
              {signInError && (
                <div className="mb-4 p-3 bg-danger-subtle border border-danger/30 rounded-lg text-sm text-danger">
                  {signInError}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-content-secondary uppercase tracking-wider mb-1.5">Email</label>
                  <input
                    type="email"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(inputValueFromEvent(e))}
                    placeholder="you@example.com"
                    className="app-input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-secondary uppercase tracking-wider mb-1.5">Password</label>
                  <input
                    type="password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(inputValueFromEvent(e))}
                    placeholder="••••••••"
                    className="app-input"
                    required
                  />
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <button
                  type="submit"
                  className="w-full flex justify-center items-center c-btn c-btn-primary py-3 font-semibold"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={handleSignInWithGoogle}
                  disabled={isRedirectingToGoogle}
                  className="w-full flex justify-center items-center c-btn c-btn-ghost py-3 gap-2 font-semibold disabled:opacity-60 disabled:pointer-events-none"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  {isRedirectingToGoogle ? 'Redirecting…' : 'Sign in with Google'}
                </button>
              </div>
              <p className="text-xs text-content-muted mt-4 text-center">
                Sign in to save and publish courses. Configure Supabase in .env.local for persistence.
              </p>
              </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowProfileModal(false)}>
          <div className="app-card rounded-lg shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-line flex items-center justify-between">
              <h3 className="text-xl font-semibold text-content">Profile</h3>
              <button 
                onClick={() => setShowProfileModal(false)}
                className="p-2 hover:bg-overlay rounded-lg transition-all text-content-secondary"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Profile Header */}
              <div className="text-center mb-6">
                <ThemeAvatar initials={userDisplay.initials} className="w-24 h-24 text-3xl mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-content">{userDisplay.displayName}</h2>
                <p className="text-content-secondary mt-1">{userDisplay.role}</p>
                {userDisplay.email && <p className="text-sm text-content-muted mt-1">{userDisplay.email}</p>}
              </div>
              {userDisplay.role === 'Sign in to save' && (
                <div className="mb-6">
                  <button
                    onClick={() => { setShowProfileModal(false); setShowSignInModal(true); }}
                    className="w-full py-3 btn-brand rounded-xl font-semibold"
                  >
                    Sign In
                  </button>
                </div>
              )}

              {userDisplay.role !== 'Sign in to save' && (
                <div className="mb-6">
                  {sessionMode === 'instructor' ? (
                    <button
                      type="button"
                      onClick={() => {
                        void persistSessionMode('learner', user?.id).then(() => {
                          setSessionMode('learner');
                          setCurrentView('courses');
                          setShowProfileModal(false);
                        });
                      }}
                      className="w-full py-2.5 btn-secondary flex items-center justify-center gap-2 text-sm font-semibold"
                    >
                      <BookOpen className="w-4 h-4" />
                      Switch to Learner view
                    </button>
                  ) : sessionMode === 'learner' ? (
                    <button
                      type="button"
                      onClick={() => {
                        void persistSessionMode('instructor', user?.id).then(() => {
                          setSessionMode('instructor');
                          setCurrentView('dashboard');
                          setShowProfileModal(false);
                        });
                      }}
                      className="w-full py-2.5 btn-secondary flex items-center justify-center gap-2 text-sm font-semibold"
                    >
                      <Video className="w-4 h-4" />
                      Switch to Instructor view
                    </button>
                  ) : null}
                </div>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <ThemeStatCard icon={BookOpen} title="Courses" value={profileStats.courses} variant="info" className="text-center [&_p]:text-center" />
                <ThemeStatCard icon={Award} title="Certificates" value={profileStats.certificates} variant="success" className="text-center [&_p]:text-center" />
                <ThemeStatCard icon={Zap} title="Badges" value={profileStats.badges} variant="neutral" className="text-center [&_p]:text-center" />
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button 
                  onClick={() => {
                    setCurrentView('profile');
                    setShowProfileModal(false);
                  }}
                  className="w-full px-4 py-3 bg-raised hover:bg-canvas border border-line rounded-xl flex items-center justify-between transition-all text-left"
                >
                  <span className="flex items-center font-semibold text-sm text-content">
                    <User className="w-4 h-4 mr-3 text-content-secondary" />
                    View Full Profile
                  </span>
                  <ChevronRight className="w-4 h-4 text-content-muted" />
                </button>
                <button 
                  onClick={() => {
                    setCurrentView('settings');
                    setShowProfileModal(false);
                  }}
                  className="w-full px-4 py-3 bg-raised hover:bg-canvas border border-line rounded-xl flex items-center justify-between transition-all text-left"
                >
                  <span className="flex items-center font-semibold text-sm text-content">
                    <Settings className="w-4 h-4 mr-3 text-content-secondary" />
                    Account Settings
                  </span>
                  <ChevronRight className="w-4 h-4 text-content-muted" />
                </button>
                <button 
                  onClick={() => { handleLogout(); setShowProfileModal(false); }}
                  className="w-full px-4 py-3 bg-danger-subtle hover:bg-danger-subtle/80 border border-danger/30 rounded-xl flex items-center justify-between transition-all text-danger"
                >
                  <span className="flex items-center font-semibold text-sm">
                    <LogOut className="w-4 h-4 mr-3" />
                    Sign Out
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </CoursifyAppLayout>
  );
};

export default CoursifyLMS;
