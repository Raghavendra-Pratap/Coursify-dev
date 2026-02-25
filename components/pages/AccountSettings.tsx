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
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { LearningPreferences } from '../LearningPreferences';

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

const defaultSettings: SettingsState = {
  theme: 'light',
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
  const router = useRouter();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  const update = (patch: Partial<SettingsState>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveStored(patch);
      return next;
    });
  };

  const handleClearCache = () => {
    if (typeof window !== 'undefined' && window.caches) {
      caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
    }
    saveStored({});
    setSettings({ ...defaultSettings, ...loadStored() });
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
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Account Settings</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your account preferences and security</p>
      </div>

      <Section icon={Lock} title="Security">
        <Row
          label="Password"
          description="Change your password"
          action={
            <button className="px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg">
              Change
            </button>
          }
        />
        <Row
          label="Two-Factor Authentication"
          description="Add an extra layer of security"
          action={
            <button className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
              Enable
            </button>
          }
        />
        <Row
          label="Active Sessions"
          description="Manage devices logged into your account"
          action={
            <button className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
              Manage
            </button>
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
          description="Select your preferred language"
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

      <Section icon={Bell} title="Notifications">
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
      </Section>

      <Section icon={BookOpen} title="Learning Preferences">
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
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Weights learned from your activity (video, reading, quiz).</p>
        <LearningPreferences />
      </div>

      <Section icon={User} title="Privacy">
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
          description="Export your data"
          action={
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <ChevronRight className="w-5 h-5" />
            </button>
          }
        />
        <Row
          label="Clear Cache"
          description="Clear locally stored preferences"
          action={
            <button onClick={handleClearCache} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <ChevronRight className="w-5 h-5" />
            </button>
          }
        />
      </Section>

      <Section icon={HelpCircle} title="Support">
        <Row label="Help Center" action={<ChevronRight className="w-5 h-5 text-gray-400" />} />
        <Row label="Contact Support" action={<ChevronRight className="w-5 h-5 text-gray-400" />} />
        <Row label="Terms & Privacy" action={<ChevronRight className="w-5 h-5 text-gray-400" />} />
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
              <p className="text-sm text-gray-600 dark:text-gray-400">Temporarily disable your account</p>
            </div>
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
    </div>
  );
}
