'use client'

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Play, Upload, Edit, Users, BarChart3, Settings, Plus, Check, X, Clock, FileText, Video, Folder, ChevronRight, Menu, Search, Bell, Award, TrendingUp, Home, BookOpen, Zap, Eye, Share2, Download, Target, Mail, User, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import AccountSettings from './pages/AccountSettings';
import MyLearning from './pages/MyLearning';

const SESSION_MODE_KEY = 'coursify_session_mode';
type SessionMode = 'instructor' | 'learner' | null;

const pageLoading = () => (
  <div className="flex min-h-[60vh] items-center justify-center p-8">
    <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading…</div>
  </div>
);

const CreateCourse = dynamic(() => import('./pages/CreateCourse'), { loading: pageLoading, ssr: false });
const MyCourses = dynamic(() => import('./pages/MyCourses'), { loading: pageLoading, ssr: false });
const Learners = dynamic(() => import('./pages/Learners'), { loading: pageLoading, ssr: false });
const Analytics = dynamic(() => import('./pages/Analytics'), { loading: pageLoading, ssr: false });
const Reports = dynamic(() => import('./pages/Reports'), { loading: pageLoading, ssr: false });
const TakeCourse = dynamic(() => import('./pages/TakeCourse'), { loading: pageLoading, ssr: false });

type UserDisplay = { displayName: string; email?: string; initials: string; role?: string };

const CoursifyLMS = () => {
  const { user, isLoading: authLoading, isAuthenticated, signOut: authSignOut } = useAuth();
  const [sessionMode, setSessionMode] = useState<SessionMode>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInError, setSignInError] = useState<string | null>(null);
  const [userDisplay, setUserDisplay] = useState<UserDisplay>({ displayName: 'Guest', initials: '—', role: 'Sign in to save' });
  const [profileStats, setProfileStats] = useState({ courses: 0, certificates: 0, badges: 0 });
  const [isRedirectingToGoogle, setIsRedirectingToGoogle] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [learningCourseId, setLearningCourseId] = useState<string | null>(null);
  const authChecked = !authLoading;
  /** Only restore dashboard/courses view on initial load or login; don't overwrite when user ref changes (e.g. tab focus token refresh) */
  const sessionViewRestoredRef = useRef(false);

  // Apply saved theme (dark/light) on load. Default is dark; users can switch to light in Settings.
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' && window.localStorage.getItem('coursify_account_settings');
      const parsed = raw ? JSON.parse(raw) : null;
      const theme = parsed?.theme === 'light' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', theme === 'dark');
    } catch {
      document.documentElement.classList.add('dark');
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
      window.history.replaceState({}, '', url);
    }).catch(() => {
      window.history.replaceState({}, '', window.location.pathname);
    });
  }, []);

  // Sync auth context user -> userDisplay and profileStats; restore session mode from localStorage
  useEffect(() => {
    if (!user) {
      setUserDisplay({ displayName: 'Guest', initials: '—', role: 'Sign in to save' });
      setProfileStats({ courses: 0, certificates: 0, badges: 0 });
      setSessionMode(null);
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
      if (!sessionViewRestoredRef.current) {
        sessionViewRestoredRef.current = true;
        if (mode === 'learner') setCurrentView('courses');
        else if (mode === 'instructor') setCurrentView('dashboard');
      }
    };
    supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('user_id', user.id).then(({ count }) => {
      const n = count ?? 0;
      setProfileStats({ courses: n, certificates: 0, badges: 0 });
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(SESSION_MODE_KEY);
        let mode: SessionMode = saved === 'learner' || saved === 'instructor' ? saved : null;
        if (mode === null && n > 0) {
          mode = 'learner';
          localStorage.setItem(SESSION_MODE_KEY, 'learner');
        }
        setSessionMode(mode);
        maybeRestoreView(mode);
      }
    });
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SESSION_MODE_KEY);
      const mode: SessionMode = saved === 'learner' || saved === 'instructor' ? saved : null;
      if (mode !== null) {
        setSessionMode(mode);
        maybeRestoreView(mode);
      }
    }
  }, [user]);

  // After sign-in: process pending invites (auto-enroll) and ?enroll= param; default invited users to learner mode
  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const enrollCourseId = params.get('enroll');

      const res = await fetch('/api/invites/process-pending', { method: 'POST', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      const enrolledFromInvites = (data?.enrolled ?? 0) > 0;
      if (enrolledFromInvites) {
        window.localStorage.setItem(SESSION_MODE_KEY, 'learner');
        setSessionMode('learner');
        setCurrentView('courses');
      }

      if (enrollCourseId) {
        const enrollRes = await fetch(`/api/courses/${encodeURIComponent(enrollCourseId)}/enroll`, {
          method: 'POST',
          credentials: 'include',
        });
        if (enrollRes.ok) {
          window.localStorage.setItem(SESSION_MODE_KEY, 'learner');
          setSessionMode('learner');
          setCurrentView('courses');
        }
        params.delete('enroll');
        const search = params.toString();
        const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
        window.history.replaceState({}, '', url);
      }
    })();
  }, [user]);

  const handleLogout = async () => {
    setShowProfileModal(false);
    setUserDisplay({ displayName: 'Guest', initials: '—', role: 'Sign in to save' });
    setProfileStats({ courses: 0, certificates: 0, badges: 0 });
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
      setShowSignInModal(false);
      setSignInEmail('');
      setSignInPassword('');
      setSignInError(null);
      const session = data.session;
      const user = data.user ?? session?.user;
      if (user) {
        const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'User';
        const initials = name.split(/\s+/).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
        setUserDisplay({ displayName: name, email: user.email ?? undefined, initials, role: 'Learner' });
        const saved = typeof window !== 'undefined' ? localStorage.getItem(SESSION_MODE_KEY) : null;
        const mode: SessionMode = saved === 'learner' || saved === 'instructor' ? saved : null;
        setSessionMode(mode);
        if (mode === 'learner') setCurrentView('courses');
        else if (mode === 'instructor') setCurrentView('dashboard');
        supabase.from('user_profiles').select('full_name, role').eq('id', user.id).maybeSingle().then(({ data: profile }) => {
          if (profile) {
            const displayName = (profile.full_name ?? name) as string;
            const role = profile.role === 'admin' ? 'Admin Account' : profile.role === 'instructor' ? 'Instructor' : 'Learner';
            setUserDisplay((prev) => ({ ...prev, displayName, role }));
          }
        });
      }
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
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '';
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

  // Navigation Item Component
  const NavItem = ({ icon: Icon, label, view }: { icon: React.ElementType; label: string; view: string }) => (
    <button 
      onClick={() => setCurrentView(view)} 
      className={`w-full flex items-center p-3 rounded-lg transition-all ${
        currentView === view
          ? 'bg-white text-blue-600 shadow-lg dark:bg-gray-700 dark:text-white dark:shadow-none'
          : 'hover:bg-blue-500 dark:hover:bg-gray-700/80'
      }`}
    >
      <Icon className="w-5 h-5" />
      {sidebarOpen && <span className="ml-3 font-semibold">{label}</span>}
    </button>
  );

  // Stat Card Component
  const StatCard = ({ icon: Icon, title, value, change, color }: { icon: React.ElementType; title: string; value: string; change: string; color: 'blue' | 'purple' | 'green' | 'orange' }) => {
    const colors = {
      blue: 'from-blue-500 to-blue-600',
      purple: 'from-purple-500 to-purple-600',
      green: 'from-green-500 to-green-600',
      orange: 'from-orange-500 to-orange-600'
    };

    return (
      <div className={`bg-gradient-to-br ${colors[color]} text-white p-6 rounded-2xl shadow-lg`}>
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
            <Icon className="w-6 h-6" />
          </div>
          <span className="text-sm font-semibold bg-white bg-opacity-20 px-3 py-1 rounded-full">{change}</span>
        </div>
        <p className="text-sm opacity-90">{title}</p>
        <p className="text-4xl font-bold mt-1">{value}</p>
      </div>
    );
  };

  // Main App Layout
  const AppLayout = ({ children }: { children: React.ReactNode }) => (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar: flex column so avatar/sign-out stay at bottom of sidebar in all states */}
      <div className={`relative flex flex-col h-screen bg-gradient-to-b from-blue-600 to-blue-700 text-white transition-all flex-shrink-0 dark:from-gray-900 dark:to-gray-800 dark:border-r dark:border-gray-800 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        {/* Logo and title: always visible; full when expanded, compact when collapsed */}
        <div className={`flex-shrink-0 border-b border-blue-500 dark:border-gray-700 flex items-center ${sidebarOpen ? 'p-4 justify-between' : 'p-2 flex-col gap-2'}`}>
          <div className={`flex items-center ${sidebarOpen ? 'min-w-0 flex-1' : 'flex-col gap-1 w-full items-center'}`}>
            <div className="w-10 h-10 flex-shrink-0 bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center" title="Coursify LMS Platform">
              <Video className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            {sidebarOpen ? (
              <div className="ml-3 min-w-0">
                <span className="font-bold text-lg block truncate">Coursify</span>
                <p className="text-xs text-blue-200 dark:text-gray-400 truncate">LMS Platform</p>
              </div>
            ) : (
              <div className="text-center w-full">
                <span className="text-[10px] font-bold leading-tight block truncate text-white" title="Coursify LMS Platform">Coursify</span>
                <span className="text-[9px] text-blue-200 dark:text-gray-400 block truncate" title="LMS Platform">LMS</span>
              </div>
            )}
          </div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`flex-shrink-0 p-2 hover:bg-blue-500 dark:hover:bg-gray-700 rounded-lg ${!sidebarOpen ? 'self-center' : ''}`} title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
            <Menu className="w-5 h-5" />
          </button>
        </div>
        
        {currentView === 'take' ? (
          <div id="take-course-sidebar-content" className="flex-1 min-h-0 overflow-hidden flex flex-col" aria-label="Course content" />
        ) : (
          <nav className="flex-1 min-h-0 p-4 space-y-2 overflow-y-auto">
            {sessionMode === 'learner' ? (
              <NavItem icon={BookOpen} label="My learning" view="courses" />
            ) : (
              <>
                <NavItem icon={Home} label="Dashboard" view="dashboard" />
                <NavItem icon={Video} label="My Courses" view="courses" />
                <NavItem icon={Users} label="Learners" view="learners" />
                <NavItem icon={BarChart3} label="Analytics" view="analytics" />
                <NavItem icon={FileText} label="Reports" view="reports" />
              </>
            )}
          </nav>
        )}
        
        {/* User area: always in sidebar at bottom (expanded vs collapsed) */}
        <div className={`flex-shrink-0 border-t border-blue-500 dark:border-gray-700 bg-blue-700 dark:bg-gray-800/80 ${sidebarOpen ? 'p-4' : 'p-2 flex flex-col items-center gap-1'}`}>
          {userDisplay.role === 'Sign in to save' ? (
            <button 
              onClick={() => { setShowSignInModal(true); setShowProfileModal(false); }}
              className={sidebarOpen ? 'w-full flex items-center justify-center p-3 rounded-lg bg-white text-blue-600 hover:bg-blue-50 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 font-semibold transition-all' : 'p-2 rounded-lg hover:bg-blue-600 dark:hover:bg-gray-700 transition-all'}
              title={sidebarOpen ? undefined : 'Sign In'}
            >
              {sidebarOpen ? 'Sign In' : <User className="w-5 h-5" />}
            </button>
          ) : (
            <>
              <button 
                onClick={() => setShowProfileModal(true)}
                className={sidebarOpen ? 'w-full flex items-center p-2 rounded-lg hover:bg-blue-600 dark:hover:bg-gray-700 transition-all text-left' : 'p-2 rounded-lg hover:bg-blue-600 dark:hover:bg-gray-700 transition-all'}
                title={sidebarOpen ? undefined : userDisplay.displayName}
              >
                <div className={`bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold shadow-lg ${sidebarOpen ? 'w-10 h-10 text-sm' : 'w-9 h-9 text-xs'}`}>
                  {userDisplay.initials}
                </div>
                {sidebarOpen && (
                  <>
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-semibold">{userDisplay.displayName}</p>
                      <p className="text-xs text-blue-200 dark:text-gray-400">{userDisplay.role}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-blue-200 dark:text-gray-400" />
                  </>
                )}
              </button>
              <button 
                onClick={handleLogout}
                className={sidebarOpen ? 'w-full flex items-center p-2 rounded-lg hover:bg-blue-600 dark:hover:bg-gray-700 transition-all text-left mt-2' : 'p-2 rounded-lg hover:bg-blue-600 dark:hover:bg-gray-700 transition-all mt-1'}
                title={sidebarOpen ? undefined : 'Sign Out'}
              >
                <LogOut className={sidebarOpen ? 'w-5 h-5 mr-3' : 'w-5 h-5'} />
                {sidebarOpen && <span className="text-sm font-semibold">Sign Out</span>}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto dark:bg-gray-900">
        {children}
      </div>
    </div>
  );



  const fallback = null;

  const supabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isGuest = userDisplay.role === 'Sign in to save';
  const requireSignIn = authChecked && isGuest && supabaseConfigured;

  // Don't show the app until we've checked auth (avoids flashing dashboard to guests)
  if (supabaseConfigured && !authChecked) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-6 w-full max-w-sm">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-4 border-blue-200 dark:border-blue-900/50" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 dark:border-t-blue-400 animate-spin" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Checking sign-in…</p>
          <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full w-1/4 bg-blue-500 dark:bg-blue-400 rounded-full animate-load-bar" />
          </div>
        </div>
      </div>
    );
  }

  const needsSessionMode = !requireSignIn && authChecked && sessionMode === null && supabaseConfigured;

  if (needsSessionMode) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">How do you want to use Coursify?</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">Choose your experience. You can switch next time you sign in.</p>
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') localStorage.setItem(SESSION_MODE_KEY, 'instructor');
                setSessionMode('instructor');
                setCurrentView('dashboard');
              }}
              className="w-full py-4 px-6 rounded-xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400 text-blue-700 dark:text-blue-300 font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center gap-3"
            >
              <Video className="w-6 h-6" />
              Open as Instructor
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') localStorage.setItem(SESSION_MODE_KEY, 'learner');
                setSessionMode('learner');
                setCurrentView('courses');
              }}
              className="w-full py-4 px-6 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-200 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-3"
            >
              <BookOpen className="w-6 h-6" />
              Open as Learner
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (requireSignIn) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Sign in to Coursify</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">You need to sign in to access the dashboard and courses.</p>
          <form onSubmit={handleSignIn} className="space-y-4">
            {signInError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">{signInError}</div>
            )}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input type="email" value={signInEmail} onChange={(e) => setSignInEmail(e.target.value)} placeholder="you@example.com" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Password</label>
              <input type="password" value={signInPassword} onChange={(e) => setSignInPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" required />
            </div>
            <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold">Sign In</button>
            <button type="button" onClick={handleSignInWithGoogle} disabled={isRedirectingToGoogle} className="w-full py-3 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold flex items-center justify-center gap-2 dark:text-gray-200 disabled:opacity-60 disabled:pointer-events-none">
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              {isRedirectingToGoogle ? 'Redirecting…' : 'Sign in with Google'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      {currentView === 'dashboard' && (Dashboard != null ? <Dashboard sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} setCurrentView={setCurrentView} /> : fallback)}
      {currentView === 'courses' && (MyCourses != null ? <MyCourses setCurrentView={setCurrentView} onEditCourse={(id) => { setEditingCourseId(id); setCurrentView('create'); }} onStartCourse={(id) => { setLearningCourseId(id); setCurrentView('take'); }} sessionMode={sessionMode} learningCourseId={learningCourseId} /> : fallback)}
      {currentView === 'create' && (CreateCourse != null ? <CreateCourse setCurrentView={setCurrentView} initialCourseId={editingCourseId} onBackToCourses={() => { setEditingCourseId(null); setCurrentView('courses'); }} /> : fallback)}
      {currentView === 'take' && learningCourseId && (TakeCourse != null ? <TakeCourse courseId={learningCourseId} onBack={() => { setLearningCourseId(null); setCurrentView('courses'); }} sidebarOpen={sidebarOpen} /> : fallback)}
      {currentView === 'learners' && (Learners != null ? <Learners setCurrentView={setCurrentView} /> : fallback)}
      {currentView === 'analytics' && (Analytics != null ? <Analytics /> : fallback)}
      {currentView === 'reports' && (Reports != null ? <Reports /> : fallback)}
      {currentView === 'profile' && (Profile != null ? <Profile setCurrentView={setCurrentView} /> : fallback)}
      {currentView === 'settings' && (AccountSettings != null ? <AccountSettings /> : fallback)}

      {/* Sign In Modal */}
      {showSignInModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowSignInModal(false); setSignInError(null); }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Sign In</h3>
              <button 
                onClick={() => { setShowSignInModal(false); setSignInError(null); }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all dark:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSignIn} className="p-6">
              {signInError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                  {signInError}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Password</label>
                  <input
                    type="password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <button
                  type="submit"
                  className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold transition-all"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={handleSignInWithGoogle}
                  disabled={isRedirectingToGoogle}
                  className="w-full py-3 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold transition-all flex items-center justify-center gap-2 dark:text-gray-200 disabled:opacity-60 disabled:pointer-events-none"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  {isRedirectingToGoogle ? 'Redirecting…' : 'Sign in with Google'}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
                Sign in to save and publish courses. Configure Supabase in .env.local for persistence.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowProfileModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h3>
              <button 
                onClick={() => setShowProfileModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all dark:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Profile Header */}
              <div className="text-center mb-6">
                <div className="w-24 h-24 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-3xl mx-auto mb-4 shadow-lg">
                  {userDisplay.initials}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{userDisplay.displayName}</h2>
                <p className="text-gray-600 dark:text-gray-300 mt-1">{userDisplay.role}</p>
                {userDisplay.email && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{userDisplay.email}</p>}
              </div>
              {userDisplay.role === 'Sign in to save' && (
                <div className="mb-6">
                  <button
                    onClick={() => { setShowProfileModal(false); setShowSignInModal(true); }}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold"
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
                        if (typeof window !== 'undefined') localStorage.setItem(SESSION_MODE_KEY, 'learner');
                        setSessionMode('learner');
                        setCurrentView('courses');
                        setShowProfileModal(false);
                      }}
                      className="w-full py-2.5 flex items-center justify-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <BookOpen className="w-4 h-4" />
                      Switch to Learner view
                    </button>
                  ) : sessionMode === 'learner' ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') localStorage.setItem(SESSION_MODE_KEY, 'instructor');
                        setSessionMode('instructor');
                        setCurrentView('dashboard');
                        setShowProfileModal(false);
                      }}
                      className="w-full py-2.5 flex items-center justify-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-600 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      <Video className="w-4 h-4" />
                      Switch to Instructor view
                    </button>
                  ) : null}
                </div>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-100 dark:bg-gray-700 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{profileStats.courses}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Courses</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{profileStats.certificates}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Certificates</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{profileStats.badges}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Badges</p>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button 
                  onClick={() => {
                    setCurrentView('profile');
                    setShowProfileModal(false);
                  }}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-xl flex items-center justify-between transition-all text-left"
                >
                  <span className="flex items-center font-semibold text-sm text-gray-800 dark:text-gray-200">
                    <User className="w-4 h-4 mr-3 text-gray-600 dark:text-gray-400" />
                    View Full Profile
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
                <button 
                  onClick={() => {
                    setCurrentView('settings');
                    setShowProfileModal(false);
                  }}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-xl flex items-center justify-between transition-all text-left"
                >
                  <span className="flex items-center font-semibold text-sm text-gray-800 dark:text-gray-200">
                    <Settings className="w-4 h-4 mr-3 text-gray-600 dark:text-gray-400" />
                    Account Settings
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
                <button 
                  onClick={() => { handleLogout(); setShowProfileModal(false); }}
                  className="w-full px-4 py-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg flex items-center justify-between transition-all text-red-600 dark:text-red-400"
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
    </AppLayout>
  );
};

export default CoursifyLMS;
