'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  BookOpen,
  Award,
  RefreshCw,
  CheckCheck,
  MessageSquare,
  UserPlus,
  Settings,
} from 'lucide-react';
import { fetchJsonCached, readClientCache } from '@/lib/client-fetch-cache';
import { useAuth } from '@/contexts/AuthContext';

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  related_id: string | null;
  read_at: string | null;
  created_at: string;
};

function iconForType(type: string) {
  switch (type) {
    case 'course_update':
      return <RefreshCw className="w-4 h-4 text-brand flex-shrink-0" />;
    case 'course_completion':
    case 'completed':
      return <BookOpen className="w-4 h-4 text-ok flex-shrink-0" />;
    case 'certificate':
      return <Award className="w-4 h-4 text-warning flex-shrink-0" />;
    case 'question_answered':
    case 'question_asked':
      return <MessageSquare className="w-4 h-4 text-content-secondary flex-shrink-0" />;
    case 'new_enrollment':
      return <UserPlus className="w-4 h-4 text-info flex-shrink-0" />;
    default:
      return <Bell className="w-4 h-4 text-content-muted flex-shrink-0" />;
  }
}

interface NotificationsDropdownProps {
  onOpenCourse?: (courseId: string) => void;
  onOpenSettings: () => void;
}

export default function NotificationsDropdown({ onOpenCourse, onOpenSettings }: NotificationsDropdownProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const updatePanelPosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setPanelPos({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    const cacheKey = `notifications:${userId}`;
    const cached = readClientCache<{ notifications?: NotificationRow[]; unreadCount?: number }>(cacheKey, 30_000);
    if (cached) {
      setNotifications(cached.notifications ?? []);
      setUnreadCount(cached.unreadCount ?? 0);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const { data } = await fetchJsonCached<{ notifications?: NotificationRow[]; unreadCount?: number }>(
        cacheKey,
        '/api/notifications',
        { maxAgeMs: 30_000 }
      );
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
    } catch {
      if (!cached) {
        setError('Failed to load notifications.');
        setNotifications([]);
        setUnreadCount(0);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    fetchNotifications();
  }, [userId, fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();
    fetchNotifications();
    const onResize = () => updatePanelPosition();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, updatePanelPosition, fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const markRead = async (id: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: String(id) }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (String(n.id) === String(id) ? { ...n, read_at: new Date().toISOString() } : n))
        );
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
      setOpen(false);
    }
  };

  if (!userId) return null;

  const panel =
    open && panelPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            className="fixed w-[min(22rem,calc(100vw-1rem))] rounded-lg border border-line app-card shadow-2xl z-[200] flex flex-col overflow-hidden"
            style={{ top: panelPos.top, right: panelPos.right }}
            role="dialog"
            aria-label="Notifications"
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-line flex-shrink-0">
              <p className="text-sm font-semibold text-content">Notifications</p>
              {notifications.length > 0 && unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="overflow-y-auto min-h-[8rem] max-h-[min(60vh,360px)]">
              {loading ? (
                <p className="p-4 text-sm text-content-muted">Loading…</p>
              ) : error ? (
                <p className="p-4 text-sm text-danger">{error}</p>
              ) : notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="w-10 h-10 text-content-muted mx-auto mb-2" />
                  <p className="text-sm font-medium text-content-secondary">No notifications yet</p>
                  <p className="text-xs text-content-muted mt-1">
                    Course updates and completions will appear here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {notifications.map((n) => (
                    <li key={String(n.id)}>
                      <button
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                          n.read_at
                            ? 'hover:bg-overlay/50'
                            : 'bg-brand/10 hover:bg-brand/15'
                        }`}
                      >
                        <div className="mt-0.5">{iconForType(n.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-content truncate">{n.title}</p>
                          {n.body && (
                            <p className="text-xs text-content-secondary mt-0.5 line-clamp-2">{n.body}</p>
                          )}
                          <p className="text-[11px] text-content-muted mt-1">
                            {new Date(n.created_at).toLocaleString()}
                          </p>
                        </div>
                        {!n.read_at && (
                          <span className="w-2 h-2 rounded-full bg-brand flex-shrink-0 mt-2" aria-hidden />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex-shrink-0 border-t border-line px-3 py-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenSettings();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-content-secondary hover:bg-overlay transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                Notification settings
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`relative p-2 rounded-lg transition-colors ${
          open
            ? 'bg-brand/15 text-brand'
            : 'text-content-secondary hover:bg-raised'
        }`}
        title="Notifications"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {panel}
    </>
  );
}
