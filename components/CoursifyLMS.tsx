'use client'

import React, { useState, useEffect } from 'react';
import { Play, Upload, Edit, Users, BarChart3, Settings, Plus, Check, X, Clock, FileText, Video, Folder, ChevronRight, Menu, Search, Bell, Award, TrendingUp, Home, BookOpen, Zap, Eye, Share2, Download, Target, Mail, User, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Dashboard from './pages/Dashboard';
import CreateCourse from './pages/CreateCourse';
import MyCourses from './pages/MyCourses';
import Learners from './pages/Learners';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import Profile from './pages/Profile';
import AccountSettings from './pages/AccountSettings';

// Guard: detect undefined page (wrong export or circular dep)
const pageNames = ['Dashboard', 'CreateCourse', 'MyCourses', 'Learners', 'Analytics', 'Reports', 'Profile', 'AccountSettings'] as const;
const pageComponents = [Dashboard, CreateCourse, MyCourses, Learners, Analytics, Reports, Profile, AccountSettings];
const undefinedPages = pageNames.filter((_, i) => pageComponents[i] == null);
if (undefinedPages.length > 0) {
  console.error('CoursifyLMS: undefined page component(s):', undefinedPages);
}

type UserDisplay = { displayName: string; email?: string; initials: string; role?: string };

const CoursifyLMS = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInError, setSignInError] = useState<string | null>(null);
  const [userDisplay, setUserDisplay] = useState<UserDisplay>({ displayName: 'Guest', initials: '—', role: 'Sign in to save' });
  const [profileStats, setProfileStats] = useState({ courses: 0, certificates: 0, badges: 0 });
  const [authChecked, setAuthChecked] = useState(false);

  // Apply saved theme (dark/light) on load so dark mode works before user opens Settings
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' && window.localStorage.getItem('coursify_account_settings');
      const parsed = raw ? JSON.parse(raw) : null;
      const theme = parsed?.theme === 'dark' ? 'dark' : 'light';
      document.documentElement.classList.toggle('dark', theme === 'dark');
    } catch {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setUserDisplay({ displayName: 'Guest', initials: '—', role: 'Sign in to save' });
        setProfileStats({ courses: 0, certificates: 0, badges: 0 });
        setAuthChecked(true);
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setUserDisplay({ displayName: 'Guest', initials: '—', role: 'Sign in to save' });
          setProfileStats({ courses: 0, certificates: 0, badges: 0 });
          return;
        }
        const name = session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? session.user.email?.split('@')[0] ?? 'User';
        const initials = name.split(/\s+/).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
        const { data: profileData, error: profileError } = await supabase.from('user_profiles').select('full_name, role').eq('id', session.user.id).maybeSingle();
        if (profileError) {
          setUserDisplay({ displayName: name, email: session.user.email ?? undefined, initials: initials || 'U', role: 'Learner' });
        } else {
          const profile = profileData as { full_name: string | null; role: string } | null;
          const displayName = (profile?.full_name ?? name) as string;
          const role = profile?.role === 'admin' ? 'Admin Account' : profile?.role === 'instructor' ? 'Instructor' : 'Learner';
          setUserDisplay({
            displayName,
            email: session.user.email ?? undefined,
            initials: initials || 'U',
            role
          });
        }
        const { count: coursesCount } = await supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id);
        setProfileStats({ courses: coursesCount ?? 0, certificates: 0, badges: 0 });
      } catch {
        setUserDisplay({ displayName: 'Guest', initials: '—', role: 'Sign in to save' });
        setProfileStats({ courses: 0, certificates: 0, badges: 0 });
      } finally {
        setAuthChecked(true);
      }
    };
    loadUser();
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => loadUser());
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    setShowProfileModal(false);
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setUserDisplay({ displayName: 'Guest', initials: '—', role: 'Sign in to save' });
      setProfileStats({ courses: 0, certificates: 0, badges: 0 });
      return;
    }
    try {
      const { error } = await supabase.auth.signOut();
      setUserDisplay({ displayName: 'Guest', initials: '—', role: 'Sign in to save' });
      setProfileStats({ courses: 0, certificates: 0, badges: 0 });
      if (error) console.warn('Sign out warning:', error.message);
    } catch (err) {
      console.warn('Sign out error:', err);
      setUserDisplay({ displayName: 'Guest', initials: '—', role: 'Sign in to save' });
      setProfileStats({ courses: 0, certificates: 0, badges: 0 });
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError(null);
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setSignInError('Sign-in is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local');
      return;
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: signInEmail.trim(), password: signInPassword });
      if (error) {
        setSignInError(error.message || 'Sign in failed');
        return;
      }
      setShowSignInModal(false);
      setSignInEmail('');
      setSignInPassword('');
      setSignInError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const name = session.user.user_metadata?.full_name ?? session.user.email?.split('@')[0] ?? 'User';
        const initials = name.split(/\s+/).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
        setUserDisplay({ displayName: name, email: session.user.email ?? undefined, initials, role: 'Instructor' });
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
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : '' } });
      if (error) setSignInError(error.message || 'Google sign-in failed');
    } catch (err) {
      setSignInError(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  };

  // Navigation Item Component
  const NavItem = ({ icon: Icon, label, view }: { icon: React.ElementType; label: string; view: string }) => (
    <button 
      onClick={() => setCurrentView(view)} 
      className={`w-full flex items-center p-3 rounded-lg transition-all ${
        currentView === view ? 'bg-white text-blue-600 shadow-lg' : 'hover:bg-blue-500'
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
      {/* Sidebar */}
      <div className={`bg-gradient-to-b from-blue-600 to-blue-700 text-white transition-all ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-4 border-b border-blue-500 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <Video className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-3">
                <span className="font-bold text-lg">Coursify</span>
                <p className="text-xs text-blue-200">LMS Platform</p>
              </div>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-blue-500 rounded-lg">
            <Menu className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="p-4 space-y-2">
          <NavItem icon={Home} label="Dashboard" view="dashboard" />
          <NavItem icon={Video} label="My Courses" view="courses" />
          <NavItem icon={Users} label="Learners" view="learners" />
          <NavItem icon={BarChart3} label="Analytics" view="analytics" />
          <NavItem icon={FileText} label="Reports" view="reports" />
        </nav>
        
        {/* User area: full when sidebar open, icon when collapsed */}
        {sidebarOpen ? (
          <div className="absolute bottom-0 w-64 p-4 border-t border-blue-500 bg-blue-700">
            {userDisplay.role === 'Sign in to save' ? (
              <button 
                onClick={() => { setShowSignInModal(true); setShowProfileModal(false); }}
                className="w-full flex items-center justify-center p-3 rounded-lg bg-white text-blue-600 hover:bg-blue-50 font-semibold transition-all"
              >
                Sign In
              </button>
            ) : (
              <>
                <button 
                  onClick={() => setShowProfileModal(true)}
                  className="w-full flex items-center p-2 rounded-lg hover:bg-blue-600 transition-all text-left"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    {userDisplay.initials}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-semibold">{userDisplay.displayName}</p>
                    <p className="text-xs text-blue-200">{userDisplay.role}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-blue-200" />
                </button>
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center p-2 rounded-lg hover:bg-blue-600 transition-all text-left mt-2"
                >
                  <LogOut className="w-5 h-5 mr-3" />
                  <span className="text-sm font-semibold">Sign Out</span>
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-blue-500 bg-blue-700 flex flex-col items-center gap-1">
            {userDisplay.role === 'Sign in to save' ? (
              <button 
                onClick={() => { setShowSignInModal(true); setShowProfileModal(false); }}
                className="p-2 rounded-lg hover:bg-blue-600 transition-all"
                title="Sign In"
              >
                <User className="w-5 h-5" />
              </button>
            ) : (
              <>
                <button 
                  onClick={() => setShowProfileModal(true)}
                  className="p-2 rounded-lg hover:bg-blue-600 transition-all"
                  title={userDisplay.displayName}
                >
                  <div className="w-9 h-9 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg">
                    {userDisplay.initials}
                  </div>
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-2 rounded-lg hover:bg-blue-600 transition-all"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto dark:bg-gray-900">
        {children}
      </div>
    </div>
  );



  // Render current view (never render undefined component)
  const fallback = undefinedPages.length > 0 ? (
    <div className="p-8 text-center text-gray-600 dark:text-gray-400">
      <p className="text-red-600 dark:text-red-400">Missing component(s): {undefinedPages.join(', ')}. Check exports in components/pages.</p>
    </div>
  ) : null;

  const supabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isGuest = userDisplay.role === 'Sign in to save';
  const requireSignIn = authChecked && isGuest && supabaseConfigured;

  // Don't show the app until we've checked auth (avoids flashing dashboard to guests)
  if (supabaseConfigured && !authChecked) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-gray-600 dark:text-gray-400">Checking sign-in…</div>
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
            <button type="button" onClick={handleSignInWithGoogle} className="w-full py-3 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold flex items-center justify-center gap-2 dark:text-gray-200">
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Sign in with Google
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      {currentView === 'dashboard' && (Dashboard != null ? <Dashboard sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} setCurrentView={setCurrentView} /> : fallback)}
      {currentView === 'courses' && (MyCourses != null ? <MyCourses setCurrentView={setCurrentView} /> : fallback)}
      {currentView === 'create' && (CreateCourse != null ? <CreateCourse setCurrentView={setCurrentView} /> : fallback)}
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
                  className="w-full py-3 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold transition-all flex items-center justify-center gap-2 dark:text-gray-200"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Sign in with Google
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
