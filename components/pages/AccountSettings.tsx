'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lock,
  Monitor,
  Bell,
  BookOpen,
  User,
  Cloud,
  HelpCircle,
  AlertTriangle,
  ChevronRight,
  Sun,
  Moon,
  X,
} from 'lucide-react';
import { fetchJsonCached, readClientCache } from '@/lib/client-fetch-cache';
import { supabase } from '@/lib/supabase';
import { LearningPreferences } from '../LearningPreferences';

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'invite@bsoc.space';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');

const STORAGE_KEY = 'coursify_account_settings';

type SettingsState = {
  theme: 'light' | 'dark';
  language: string;
  emailNotifications: boolean;
  courseReminders: boolean;
  achievementNotifications: boolean;
  weeklyReports: boolean;
  soundEffects: boolean;
  autoplayVideos: boolean;
  publicProfile: boolean;
  showAchievements: boolean;
  showLearningProgress: boolean;
};


type NotificationPreferences = {
  notify_course_updates: boolean;
  notify_question_answers: boolean;
  notify_new_questions: boolean;
  notify_enrollments: boolean;
};

const defaultNotificationPreferences: NotificationPreferences = {
  notify_course_updates: true,
  notify_question_answers: true,
  notify_new_questions: true,
  notify_enrollments: true,
};

const defaultSettings: SettingsState = {
  theme: 'dark',
  language: 'en',
  emailNotifications: true,
  courseReminders: true,
  achievementNotifications: true,
  weeklyReports: false,
  soundEffects: true,
  autoplayVideos: true,
  publicProfile: true,
  showAchievements: true,
  showLearningProgress: false,
};

function loadStored(): Partial<SettingsState> {
  if (typeof window === 'undefined') return {};
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

function saveStored(settings: Partial<SettingsState>) {
  if (typeof window === 'undefined') return;
  try {
    const current = loadStored();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...settings }));
  } catch {}
}

export default function AccountSettings() {
  const [settings, setSettings] = useState<SettingsState>(() => ({ ...defaultSettings, ...loadStored() }));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(defaultNotificationPreferences);
  const [notifPrefLoading, setNotifPrefLoading] = useState(true);
  const [notifPrefSaving, setNotifPrefSaving] = useState<string | null>(null);
  const [notifPrefError, setNotifPrefError] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaMessage, setMfaMessage] = useState<string | null>(null);
  const [downloadingData, setDownloadingData] = useState(false);
  const [downloadDataMessage, setDownloadDataMessage] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  useEffect(() => {
    let mounted = true;
    const loadSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted || !user) return;
      setSessionEmail(user.email ?? null);
      setLastSignIn(user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : null);
      try {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp ?? [];
        setMfaEnabled(totp.some((f) => f.status === 'verified'));
      } catch {
        setMfaEnabled(false);
      }
    };
    loadSession();
    return () => { mounted = false; };
  }, []);


  useEffect(() => {
    let mounted = true;
    const loadNotificationPreferences = async () => {
      const cached = readClientCache<{ preferences?: Partial<NotificationPreferences> }>('notification-preferences', 60_000);
      if (cached?.preferences && mounted) {
        setNotificationPreferences({
          notify_course_updates: cached.preferences.notify_course_updates ?? true,
          notify_question_answers: cached.preferences.notify_question_answers ?? true,
          notify_new_questions: cached.preferences.notify_new_questions ?? true,
          notify_enrollments: cached.preferences.notify_enrollments ?? true,
        });
        setNotifPrefLoading(false);
      } else {
        setNotifPrefLoading(true);
      }
      setNotifPrefError(null);
      try {
        const { data } = await fetchJsonCached<{ preferences?: Partial<NotificationPreferences> }>(
          'notification-preferences',
          '/api/notification-preferences'
        );
        const prefs = data.preferences;
        if (mounted && prefs) {
          setNotificationPreferences({
            notify_course_updates: prefs.notify_course_updates ?? true,
            notify_question_answers: prefs.notify_question_answers ?? true,
            notify_new_questions: prefs.notify_new_questions ?? true,
            notify_enrollments: prefs.notify_enrollments ?? true,
          });
        }
      } catch {
        if (mounted && !cached?.preferences) setNotifPrefError('Failed to load in-app notification settings.');
      } finally {
        if (mounted) setNotifPrefLoading(false);
      }
    };
    loadNotificationPreferences();
    return () => {
      mounted = false;
    };
  }, []);

  const update = (patch: Partial<SettingsState>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveStored(patch);
      return next;
    });
  };


  const updateNotificationPreference = async (key: keyof NotificationPreferences, value: boolean) => {
    const prev = notificationPreferences;
    const next = { ...notificationPreferences, [key]: value };
    setNotifPrefError(null);
    setNotifPrefSaving(key);
    setNotificationPreferences(next);
    try {
      const res = await fetch('/api/notification-preferences', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNotificationPreferences(prev);
        setNotifPrefError((data as { error?: string }).error || 'Failed to save in-app notification settings.');
      }
    } catch {
      setNotificationPreferences(prev);
      setNotifPrefError('Failed to save in-app notification settings.');
    } finally {
      setNotifPrefSaving(null);
    }
  };

  const handleClearCache = () => {
    if (typeof window !== 'undefined' && window.caches) {
      caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
    }
    saveStored({});
    setSettings({ ...defaultSettings, ...loadStored() });
  };

  const handleDownloadMyData = async () => {
    setDownloadingData(true);
    setDownloadDataMessage(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setDownloadDataMessage('Sign in to export your data.');
        return;
      }
      const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle();
      const { data: enrollments } = await supabase.from('enrollments').select('*').eq('user_id', user.id);
      const enrollmentIds = (enrollments ?? []).map((e) => e.id);
      const { data: progress } = enrollmentIds.length
        ? await supabase.from('progress').select('*').in('enrollment_id', enrollmentIds)
        : { data: [] as Record<string, unknown>[] };
      const payload = {
        exportedAt: new Date().toISOString(),
        user: { id: user.id, email: user.email, created_at: user.created_at },
        profile: profile ?? null,
        enrollments: enrollments ?? [],
        progress: progress ?? [],
        localSettings: loadStored(),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coursify-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloadDataMessage('Your data export has started.');
    } catch {
      setDownloadDataMessage('Could not export data. Try again later.');
    } finally {
      setDownloadingData(false);
      setTimeout(() => setDownloadDataMessage(null), 5000);
    }
  };

  const handleContactSupport = () => {
    window.location.href = `mailto:${encodeURIComponent(SUPPORT_EMAIL)}?subject=${encodeURIComponent('Coursify support request')}&body=${encodeURIComponent(`Describe your issue:\n\nApp: ${APP_URL}\nEmail: ${sessionEmail ?? ''}\n`)}`;
  };

  const handleDeactivateAccount = async () => {
    setDeactivating(true);
    try {
      await supabase.auth.signOut();
      saveStored({});
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
      setShowDeactivateModal(false);
      router.push('/');
      window.location.href = '/';
    } finally {
      setDeactivating(false);
    }
  };

  const handleManageMfa = async () => {
    setMfaMessage(null);
    setShowMfaModal(true);
    try {
      const { data: factors, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const totp = factors?.totp ?? [];
      setMfaEnabled(totp.some((f) => f.status === 'verified'));
      if (totp.length === 0) {
        setMfaMessage('Two-factor authentication is not enabled. Enroll via Supabase Auth MFA in your project dashboard, or ask your admin to enable TOTP for your organization.');
      } else {
        setMfaMessage(`You have ${totp.length} authenticator factor(s) configured.`);
      }
    } catch {
      setMfaMessage('Could not load MFA status. Ensure MFA is enabled in your Supabase project.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordError(error.message || 'Failed to update password.');
        return;
      }
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => { setShowPasswordModal(false); setPasswordSuccess(false); }, 1500);
    } catch {
      setPasswordError('Something went wrong.');
    } finally {
      setChangingPassword(false);
    }
  };

  const Section = ({
    icon: Icon,
    title,
    children,
  }: {
    icon: React.ElementType;
    title: string;
    children: React.ReactNode;
  }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </div>
  );

  const Row = ({
    label,
    description,
    action,
  }: {
    label: string;
    description?: string;
    action: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div>
        <p className="font-semibold text-gray-900 dark:text-white">{label}</p>
        {description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0 ml-4">{action}</div>
    </div>
  );

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Account Settings</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your account preferences and security</p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          Theme and password change work now. In-app notification settings are saved to your account. Other options are saved locally.
        </p>
      </div>

      <Section icon={Lock} title="Security">
        <Row
          label="Password"
          description="Change your password"
          action={
            <button
              type="button"
              onClick={() => { setShowPasswordModal(true); setPasswordError(null); setPasswordSuccess(false); setNewPassword(''); setConfirmPassword(''); }}
              className="px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
            >
              Change
            </button>
          }
        />
        <Row
          label="Two-Factor Authentication"
          description={mfaEnabled ? 'Authenticator app is enabled' : 'Add an extra layer of security'}
          action={
            <button
              type="button"
              onClick={handleManageMfa}
              className="px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
            >
              {mfaEnabled ? 'Manage' : 'Set up'}
            </button>
          }
        />
        <Row
          label="Active Sessions"
          description={lastSignIn ? `Last sign-in: ${lastSignIn}` : 'Current browser session'}
          action={
            <span className="text-xs text-gray-600 dark:text-gray-400 px-2 max-w-[12rem] truncate" title={sessionEmail ?? undefined}>
              {sessionEmail ?? 'Signed in'}
            </span>
          }
        />
      </Section>

      <Section icon={Monitor} title="Appearance">
        <Row
          label="Theme"
          description="Choose your interface theme"
          action={
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 p-0.5 bg-gray-100 dark:bg-gray-700">
              <button
                onClick={() => update({ theme: 'light' })}
                className={`p-2 rounded-md ${settings.theme === 'light' ? 'bg-white dark:bg-gray-600 shadow text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}
                title="Light"
              >
                <Sun className="w-4 h-4" />
              </button>
              <button
                onClick={() => update({ theme: 'dark' })}
                className={`p-2 rounded-md ${settings.theme === 'dark' ? 'bg-white dark:bg-gray-600 shadow text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}
                title="Dark"
              >
                <Moon className="w-4 h-4" />
              </button>
            </div>
          }
        />
        <Row
          label="Language"
          description="Saved; app language coming soon"
          action={
            <select
              value={settings.language}
              onChange={(e) => update({ language: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="hi">Hindi</option>
            </select>
          }
        />
      </Section>

      <Section icon={Bell} title="Notification settings">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Manage email reminders (local) and in-app alerts (saved to your account).</p>
        <Row
          label="Email Notifications"
          description="Receive updates via email"
          action={
            <input
              type="checkbox"
              checked={settings.emailNotifications}
              onChange={(e) => update({ emailNotifications: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          }
        />
        <Row
          label="Course Reminders"
          description="Get reminded about incomplete courses"
          action={
            <input
              type="checkbox"
              checked={settings.courseReminders}
              onChange={(e) => update({ courseReminders: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          }
        />
        <Row
          label="Achievement Notifications"
          description="Get notified about badges and certificates"
          action={
            <input
              type="checkbox"
              checked={settings.achievementNotifications}
              onChange={(e) => update({ achievementNotifications: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          }
        />
        <Row
          label="Weekly Reports"
          description="Receive weekly learning progress reports"
          action={
            <input
              type="checkbox"
              checked={settings.weeklyReports}
              onChange={(e) => update({ weeklyReports: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          }
        />


        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 mb-2">In-app notifications (saved to account)</p>
        <Row
          label="Course Updates"
          description="Notify me when enrolled courses are updated"
          action={
            <input
              type="checkbox"
              checked={notificationPreferences.notify_course_updates}
              onChange={(e) => updateNotificationPreference('notify_course_updates', e.target.checked)}
              disabled={notifPrefLoading || notifPrefSaving === 'notify_course_updates'}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
            />
          }
        />
        <Row
          label="Answers to My Questions"
          description="Notify me when my course question gets an answer"
          action={
            <input
              type="checkbox"
              checked={notificationPreferences.notify_question_answers}
              onChange={(e) => updateNotificationPreference('notify_question_answers', e.target.checked)}
              disabled={notifPrefLoading || notifPrefSaving === 'notify_question_answers'}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
            />
          }
        />
        <Row
          label="New Learner Questions"
          description="Notify me when learners ask questions on my courses"
          action={
            <input
              type="checkbox"
              checked={notificationPreferences.notify_new_questions}
              onChange={(e) => updateNotificationPreference('notify_new_questions', e.target.checked)}
              disabled={notifPrefLoading || notifPrefSaving === 'notify_new_questions'}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
            />
          }
        />
        <Row
          label="New Enrollments"
          description="Notify me when someone enrolls in my courses"
          action={
            <input
              type="checkbox"
              checked={notificationPreferences.notify_enrollments}
              onChange={(e) => updateNotificationPreference('notify_enrollments', e.target.checked)}
              disabled={notifPrefLoading || notifPrefSaving === 'notify_enrollments'}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
            />
          }
        />
        {notifPrefError && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{notifPrefError}</p>}
      </Section>

      <Section icon={BookOpen} title="Learning Preferences">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Saved locally for when we add these features.</p>
        <Row
          label="Sound Effects"
          description="Play sounds for actions and achievements"
          action={
            <input
              type="checkbox"
              checked={settings.soundEffects}
              onChange={(e) => update({ soundEffects: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          }
        />
        <Row
          label="Autoplay Videos"
          description="Automatically play next video in sequence"
          action={
            <input
              type="checkbox"
              checked={settings.autoplayVideos}
              onChange={(e) => update({ autoplayVideos: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          }
        />
      </Section>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Inferred Learning Preferences</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Weights learned from your activity (video, reading, quiz). Display only for now.</p>
        <LearningPreferences />
      </div>

      <Section icon={User} title="Privacy">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Saved locally; will apply when profile visibility is implemented.</p>
        <Row
          label="Public Profile"
          description="Make your profile visible to others"
          action={
            <input
              type="checkbox"
              checked={settings.publicProfile}
              onChange={(e) => update({ publicProfile: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          }
        />
        <Row
          label="Show Achievements"
          description="Display your badges and certificates"
          action={
            <input
              type="checkbox"
              checked={settings.showAchievements}
              onChange={(e) => update({ showAchievements: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          }
        />
        <Row
          label="Show Learning Progress"
          description="Let others see your course progress"
          action={
            <input
              type="checkbox"
              checked={settings.showLearningProgress}
              onChange={(e) => update({ showLearningProgress: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          }
        />
      </Section>

      <Section icon={Cloud} title="Data & Storage">
        <Row
          label="Download My Data"
          description="Export profile, enrollments, and progress as JSON"
          action={
            <button
              type="button"
              onClick={handleDownloadMyData}
              disabled={downloadingData}
              className="px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-60"
            >
              {downloadingData ? 'Exporting…' : 'Download'}
            </button>
          }
        />
        {downloadDataMessage && (
          <p className="text-xs text-green-600 dark:text-green-400 pb-2">{downloadDataMessage}</p>
        )}
        <Row
          label="Clear Cache"
          description="Clear locally stored preferences (works now)"
          action={
            <button onClick={handleClearCache} className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <ChevronRight className="w-5 h-5" />
            </button>
          }
        />
      </Section>

      <Section icon={HelpCircle} title="Support">
        <Row
          label="Help Center"
          description="Getting started with Coursify"
          action={
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
            >
              Open
            </button>
          }
        />
        <Row
          label="Contact Support"
          description={SUPPORT_EMAIL}
          action={
            <button
              type="button"
              onClick={handleContactSupport}
              className="px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
            >
              Email
            </button>
          }
        />
        <Row
          label="Terms & Privacy"
          description="Usage terms and privacy summary"
          action={
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowTermsModal(true)} className="px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Terms</button>
              <button type="button" onClick={() => setShowPrivacyModal(true)} className="px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Privacy</button>
            </div>
          }
        />
      </Section>

      <div className="bg-red-50/80 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <h3 className="text-lg font-bold text-red-900 dark:text-red-200">Danger Zone</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Deactivate Account</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Sign out and clear local preferences on this device</p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeactivateModal(true)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Deactivate
            </button>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Delete Account Permanently</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">This action cannot be undone</p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700"
            >
              Delete Account Permanently
            </button>
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPasswordModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Change password</h3>
              <button onClick={() => setShowPasswordModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg dark:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordError && (
                <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
              )}
              {passwordSuccess && (
                <p className="text-sm text-green-600 dark:text-green-400">Password updated. You can close this.</p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="At least 6 characters"
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Repeat password"
                  autoComplete="new-password"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancel
                </button>
                <button type="submit" disabled={changingPassword} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {changingPassword ? 'Updating…' : 'Update password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete account?</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
              This will permanently delete your account and all associated data. This action cannot be undone.
            </p>
            {deleteError && (
              <p className="text-red-600 text-sm mb-4">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDeleteError(null);
                  setDeleting(true);
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;
                    if (!token) {
                      setDeleteError('Not signed in.');
                      return;
                    }
                    const res = await fetch('/api/auth/delete-account', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ access_token: token }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      setDeleteError(data?.error || 'Failed to delete account.');
                      return;
                    }
                    await supabase.auth.signOut();
                    setShowDeleteConfirm(false);
                    router.push('/');
                    window.location.href = '/';
                  } catch {
                    setDeleteError('Request failed.');
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMfaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowMfaModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Two-factor authentication</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {mfaMessage ?? (mfaEnabled ? 'Your account has MFA enabled.' : 'MFA is not enabled on this account.')}
            </p>
            <button type="button" onClick={() => setShowMfaModal(false)} className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700">Close</button>
          </div>
        </div>
      )}

      {showHelpModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowHelpModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Help Center</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-disc pl-5">
              <li>Create courses from <strong>My Courses → Create</strong>.</li>
              <li>Invite learners from <strong>Learners</strong> or the course share modal.</li>
              <li>Track progress on the <strong>Dashboard</strong> and <strong>Analytics</strong> pages.</li>
              <li>Videos can be YouTube, Google Drive, or any public URL with HH:MM:SS segments.</li>
              <li>Set <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">NEXT_PUBLIC_APP_URL</code> for correct invite links in email.</li>
            </ul>
            <button type="button" onClick={() => setShowHelpModal(false)} className="mt-6 w-full py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700">Close</button>
          </div>
        </div>
      )}

      {showTermsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTermsModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Terms of Use</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Coursify is provided for learning and course management. You are responsible for content you publish and learners you invite.
              Do not upload unlawful material or share access credentials. We may suspend accounts that abuse the service.
              The service is provided as-is without warranty; availability may change during beta.
            </p>
            <button type="button" onClick={() => setShowTermsModal(false)} className="mt-6 w-full py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700">Close</button>
          </div>
        </div>
      )}

      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPrivacyModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Privacy Policy</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              We store account data (email, profile) and learning activity (enrollments, progress) in Supabase to operate the LMS.
              Video content stays on YouTube, Google Drive, or URLs you provide — we do not host video files.
              Email invites are sent via Resend when configured. Use <strong>Download My Data</strong> to export your records.
              Contact {SUPPORT_EMAIL} to request account deletion.
            </p>
            <button type="button" onClick={() => setShowPrivacyModal(false)} className="mt-6 w-full py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700">Close</button>
          </div>
        </div>
      )}

      {showDeactivateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeactivateModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Deactivate on this device?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              This signs you out and clears local Coursify preferences. Your account and course data remain until you delete the account permanently.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowDeactivateModal(false)} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl font-semibold text-gray-700 dark:text-gray-200">Cancel</button>
              <button type="button" onClick={handleDeactivateAccount} disabled={deactivating} className="flex-1 py-2.5 bg-gray-800 dark:bg-gray-600 text-white rounded-xl font-semibold disabled:opacity-50">{deactivating ? 'Signing out…' : 'Deactivate'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
