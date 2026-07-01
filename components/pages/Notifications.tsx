'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BookOpen, Award, RefreshCw, CheckCheck, ChevronRight, MessageSquare, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  related_id: string | null;
  read_at: string | null;
  created_at: string;
};


interface NotificationsProps {
  setCurrentView: (view: string) => void;
  onOpenCourse?: (courseId: string) => void;
}

function iconForType(type: string) {
  switch (type) {
    case 'course_update':
      return <RefreshCw className="w-5 h-5 text-blue-500 flex-shrink-0" />;
    case 'course_completion':
    case 'completed':
      return <BookOpen className="w-5 h-5 text-emerald-500 flex-shrink-0" />;
    case 'certificate':
      return <Award className="w-5 h-5 text-amber-500 flex-shrink-0" />;
    case 'question_answered':
    case 'question_asked':
      return <MessageSquare className="w-5 h-5 text-purple-500 flex-shrink-0" />;
    case 'new_enrollment':
      return <UserPlus className="w-5 h-5 text-indigo-500 flex-shrink-0" />;
    default:
      return <Bell className="w-5 h-5 text-gray-500 flex-shrink-0" />;
  }
}

export default function Notifications({ setCurrentView, onOpenCourse }: NotificationsProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/notifications', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 401) setError('Sign in to view notifications.');
        else setError('Failed to load notifications.');
        setNotifications([]);
        return;
      }
      const data = await res.json();
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
    } catch {
      setError('Failed to load notifications.');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markRead = async (id: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: String(id) }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => (String(n.id) === String(id) ? { ...n, read_at: new Date().toISOString() } : n)));
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
        setUnreadCount(0);
      }
    } catch {
      // ignore
    }
  };

  const handleNotificationClick = (n: NotificationRow) => {
    if (!n.read_at) markRead(n.id);
    if (n.related_id && onOpenCourse) {
      onOpenCourse(n.related_id);
    }
  };

  if (!userId) {
    return (
      <div className="p-8 max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Notifications</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">Sign in to see course updates, completions, and certificates.</p>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
          <Bell className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-amber-800 dark:text-amber-200 font-medium">Sign in to view notifications</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Notifications</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Course updates, completions, and certificate allocation.
          </p>
          <button
            type="button"
            onClick={() => setCurrentView('settings')}
            className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            Notification settings → Account settings
          </button>
        </div>
        {notifications.length > 0 && unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all as read
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}


      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">Loading…</p>
      ) : notifications.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Bell className="w-16 h-16 text-gray-300 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">No notifications yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            You’ll see course updates, completion, and certificates here.
          </p>
          <button
            type="button"
            onClick={() => setCurrentView('courses')}
            className="mt-6 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
          >
            Go to My learning
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li key={String(n.id)}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleNotificationClick(n)}
                onKeyDown={(e) => e.key === 'Enter' && handleNotificationClick(n)}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-colors cursor-pointer text-left ${
                  n.read_at
                    ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    : 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                }`}
              >
                <div className="mt-0.5">{iconForType(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white">{n.title}</p>
                  {n.body && <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{n.body}</p>}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                {n.related_id && onOpenCourse && (
                  <span className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 font-medium flex-shrink-0">
                    Open course
                    <ChevronRight className="w-4 h-4" />
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
