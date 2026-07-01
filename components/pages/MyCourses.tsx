'use client'

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Users, Plus, Clock, Video, Edit, X, Eye, Filter, Grid, List, Star, TrendingUp, TrendingDown,
  Download, Share2, Copy, Trash2, Archive, MoreVertical, BookOpen, CheckCircle, Award, Mail, Link2, Globe,
  Search, BarChart3, Folder, AlertCircle, UserPlus, Loader2, Layers
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import CourseProgramSection from '@/components/CourseProgramSection';
import { downloadCsv } from '@/lib/download-csv';
import { getPreferences, getCourseRecommendationScore } from '@/lib/preference-loop';
import type { LearnerPreferences } from '@/lib/preference-loop';
import { fetchJsonCached, readClientCache, SHELL_CACHE_MS } from '@/lib/client-fetch-cache';
import { ThemeStatCard, ThemeFilterTab } from '@/components/ui/ThemeStatCard';
import { courseStatusBadge, enrollmentStageBadge, headerPrimaryBtn, headerSecondaryBtn, iconBtn, pageHeaderActions, thumbOverlayIconBtn } from '@/components/ui/theme-classes';

type SessionMode = 'instructor' | 'learner' | null;

interface MyCoursesProps {
  setCurrentView: (view: string) => void;
  onCreateCourse?: () => void;
  onEditCourse?: (courseId: string) => void;
  /** When in learner mode, opening a course goes to take-course view. */
  onStartCourse?: (courseId: string) => void;
  /** Drives which view to show: instructor (created courses) vs learner (enrolled courses). */
  sessionMode?: SessionMode;
  /** When set, user is in TakeCourse; when null, show course list. Used to refetch enrolled when returning. */
  learningCourseId?: string | null;
  /** True when the My Courses tab is visible (KeepAlive); refetch list when returning from editor. */
  listActive?: boolean;
}

type CourseId = string | number;

interface CourseRow {
  id: CourseId;
  title: string;
  description: string;
  thumbnail: string;
  modules: number;
  lessons: number;
  learners: number;
  enrolled: number;
  completion: number;
  avgRating: number;
  totalRatings: number;
  status: 'draft' | 'published' | 'archived';
  category: string;
  duration: string;
  lastUpdated: string;
  createdDate: string;
  views: number;
  trend: string;
  trendValue: number;
  hasQuiz: boolean;
  hasCertificate: boolean;
  language: string;
  level: string;
  tags: string[];
  /** Course owner (created_by); for "Unpublished changes" and publish gating */
  createdBy?: string;
  /** True after Save when course is published; cleared on Publish/Republish */
  hasUnpublishedChanges?: boolean;
}

const formatCourseDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

/** Format total seconds as "0m", "45m", "1h 20m", etc. */
const formatCourseDuration = (totalSeconds: number): string => {
  if (totalSeconds <= 0 || !Number.isFinite(totalSeconds)) return '0m';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

type EnrolledCourse = {
  id: string;
  course_id: string;
  title: string;
  progress_percentage: number;
  completed_at: string | null;
  module_count?: number;
  duration_seconds?: number;
  updated_at?: string | null;
  avg_rating?: number;
  total_ratings?: number;
  my_rating?: number | null;
  my_review?: string | null;
};

type MyCoursesPayload = {
  courses?: CourseRow[];
  totalUniqueLearners?: number;
  contentMix?: Record<string, { video: number; reading: number; quiz: number }>;
};

function normalizeCourseRows(rows: CourseRow[]): CourseRow[] {
  return rows.map((c) => ({
    ...c,
    category: c.category ?? 'General',
    status: c.status as CourseRow['status'],
    lastUpdated: formatCourseDate(c.lastUpdated),
    createdDate: formatCourseDate(c.createdDate),
  }));
}

function parseInviteEmails(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[\s,;\n]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
    ),
  );
}

function resolveCourseOwnerId(course: CourseRow | null, fetchedOwnerId: string | null): string | null {
  if (typeof course?.createdBy === 'string') return course.createdBy;
  return fetchedOwnerId;
}

function canInviteCollaborators(
  course: CourseRow | null,
  userId: string | undefined,
  fetchedOwnerId: string | null,
): boolean {
  if (!userId || !course) return false;
  const ownerId = resolveCourseOwnerId(course, fetchedOwnerId);
  return ownerId === userId;
}

function readMyCoursesCache(): MyCoursesPayload | null {
  return readClientCache<MyCoursesPayload>('instructor:my-courses', SHELL_CACHE_MS);
}

const MyCourses: React.FC<MyCoursesProps> = ({ setCurrentView, onCreateCourse, onEditCourse, onStartCourse, sessionMode = 'instructor', learningCourseId = null, listActive = true }) => {
  const openCreateCourse = () => {
    if (onCreateCourse) onCreateCourse();
    else setCurrentView('create');
  };
  const isLearnerView = sessionMode === 'learner';
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<CourseId[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<CourseRow | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [courseToShare, setCourseToShare] = useState<CourseRow | null>(null);
  const [shareCopyFeedback, setShareCopyFeedback] = useState(false);
  const [shareMagicLink, setShareMagicLink] = useState<string | null>(null);
  const [shareMagicLinkLoading, setShareMagicLinkLoading] = useState(false);
  const [shareMagicLinkError, setShareMagicLinkError] = useState<string | null>(null);
  const [shareInviteEmails, setShareInviteEmails] = useState('');
  const [shareInviteMessage, setShareInviteMessage] = useState('');
  const [shareInviteLoading, setShareInviteLoading] = useState(false);
  const [shareInviteError, setShareInviteError] = useState<string | null>(null);
  const [shareInviteSuccess, setShareInviteSuccess] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<CourseId | null>(null);
  const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false);
  const [courseForCollaborators, setCourseForCollaborators] = useState<CourseRow | null>(null);
  const [collaboratorsList, setCollaboratorsList] = useState<{ id: string; full_name: string | null; isOwner: boolean; role?: string }[]>([]);
  const [collaboratorsLoading, setCollaboratorsLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [courseOwnerId, setCourseOwnerId] = useState<string | null>(null);
  const instructorCache = readMyCoursesCache();
  const enrolledCache = readClientCache<{ courses?: EnrolledCourse[] }>('learning:enrolled', SHELL_CACHE_MS);
  const [courses, setCourses] = useState<CourseRow[]>(() =>
    instructorCache?.courses ? normalizeCourseRows(instructorCache.courses) : []
  );
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourse[]>(() => enrolledCache?.courses ?? []);
  const [enrolledLoading, setEnrolledLoading] = useState(() => enrolledCache == null);
  const [loading, setLoading] = useState(() => instructorCache == null);
  const [configMissing, setConfigMissing] = useState(false);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [preferences, setPreferences] = useState<LearnerPreferences | null>(null);
  const [contentMixByCourse, setContentMixByCourse] = useState<Record<string, { video: number; reading: number; quiz: number }>>(
    () => instructorCache?.contentMix ?? {}
  );
  const [learnerFilter, setLearnerFilter] = useState<'all' | 'enrolled' | 'in_progress' | 'completed'>('all');
  const [learnerSearch, setLearnerSearch] = useState('');
  const [learnerSort, setLearnerSort] = useState<'recent' | 'name' | 'progress'>('recent');
  const [rateModalCourse, setRateModalCourse] = useState<EnrolledCourse | null>(null);
  const [rateModalRating, setRateModalRating] = useState(0);
  const [rateModalReview, setRateModalReview] = useState('');
  const [rateSubmitting, setRateSubmitting] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [totalUniqueLearners, setTotalUniqueLearners] = useState<number | null>(
    () => (typeof instructorCache?.totalUniqueLearners === 'number' ? instructorCache.totalUniqueLearners : null)
  );
  const [userRole, setUserRole] = useState<'learner' | 'instructor' | 'admin' | null>(null);
  const [programCount, setProgramCount] = useState(0);
  const [programCreateRequested, setProgramCreateRequested] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? undefined);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? undefined);
    });
    return () => { subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!userId) {
      setUserRole(null);
      return;
    }
    (async () => {
      const { data } = await (supabase as any).from('user_profiles').select('role').eq('id', userId).maybeSingle();
      const r = (data as { role?: string } | null)?.role;
      setUserRole(r === 'admin' ? 'admin' : r === 'instructor' ? 'instructor' : r === 'learner' ? 'learner' : null);
    })();
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setPreferences(null);
      return;
    }
    getPreferences(userId).then(setPreferences);
  }, [userId]);

  useEffect(() => {
    if (!isLearnerView || learningCourseId) return;
    const hit = readClientCache<{ courses?: EnrolledCourse[] }>('learning:enrolled', SHELL_CACHE_MS);
    if (hit) {
      setEnrolledCourses(hit.courses ?? []);
      setEnrolledLoading(false);
    } else {
      setEnrolledLoading(true);
    }
    fetchJsonCached<{ courses?: EnrolledCourse[] }>('learning:enrolled', '/api/learning/enrolled', { maxAgeMs: SHELL_CACHE_MS })
      .then(({ data }) => {
        setEnrolledCourses(Array.isArray(data.courses) ? data.courses : []);
      })
      .catch(() => setEnrolledCourses([]))
      .finally(() => setEnrolledLoading(false));
  }, [isLearnerView, learningCourseId]);

  useEffect(() => {
    if (isLearnerView) return;
    let cancelled = false;

    const applyPayload = (data: MyCoursesPayload) => {
      const rows = (data.courses ?? []).map((c) => ({
        ...c,
        category: c.category ?? 'General',
        status: c.status as CourseRow['status'],
        lastUpdated: formatCourseDate(c.lastUpdated),
        createdDate: formatCourseDate(c.createdDate),
      }));
      setCourses(rows);
      if (typeof data.totalUniqueLearners === 'number') setTotalUniqueLearners(data.totalUniqueLearners);
      if (data.contentMix) setContentMixByCourse(data.contentMix);
    };

    const load = async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setCourses([]);
        setConfigMissing(true);
        setLoading(false);
        return;
      }
      setConfigMissing(false);
      const cached = readMyCoursesCache();
      if (cached) {
        applyPayload(cached);
        setLoading(false);
      }
      try {
        const { data } = await fetchJsonCached<MyCoursesPayload>(
          'instructor:my-courses',
          '/api/instructor/my-courses',
          { maxAgeMs: SHELL_CACHE_MS }
        );
        if (cancelled) return;
        applyPayload(data);
      } catch {
        if (!cancelled) setCourses([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [isLearnerView]);

  const prevListActiveRef = useRef(listActive);
  useEffect(() => {
    const becameActive = listActive && !prevListActiveRef.current;
    prevListActiveRef.current = listActive;
    if (!becameActive || isLearnerView || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await fetchJsonCached<MyCoursesPayload>(
          'instructor:my-courses',
          '/api/instructor/my-courses',
          { maxAgeMs: SHELL_CACHE_MS, forceRefresh: true }
        );
        if (cancelled) return;
        const rows = (data.courses ?? []).map((c) => ({
          ...c,
          category: c.category ?? 'General',
          status: c.status as CourseRow['status'],
          lastUpdated: formatCourseDate(c.lastUpdated),
          createdDate: formatCourseDate(c.createdDate),
        }));
        setCourses(rows);
        if (typeof data.totalUniqueLearners === 'number') setTotalUniqueLearners(data.totalUniqueLearners);
        if (data.contentMix) setContentMixByCourse(data.contentMix);
      } catch {
        // keep existing list on refresh failure
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [listActive, isLearnerView]);

  const thumbnailColors: Record<string, string> = {
    blue: 'from-blue-400 to-blue-500',
    purple: 'from-purple-400 to-purple-500',
    green: 'from-green-400 to-green-500',
    orange: 'from-orange-400 to-orange-500',
    pink: 'from-pink-400 to-pink-500',
    indigo: 'from-indigo-400 to-indigo-500'
  };

  // Filter and sort courses
  const getFilteredCourses = () => {
    let filtered = courses;

    if (selectedFilter !== 'all' && selectedFilter !== 'programs') {
      filtered = filtered.filter(c => c.status === selectedFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(c => 
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    switch(sortBy) {
      case 'name':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'learners':
        filtered.sort((a, b) => b.learners - a.learners);
        break;
      case 'completion':
        filtered.sort((a, b) => b.completion - a.completion);
        break;
      case 'recommended':
        if (preferences) {
          filtered.sort((a, b) => {
            const mixA = contentMixByCourse[String(a.id)] ?? { video: 1, reading: 0, quiz: 0 };
            const mixB = contentMixByCourse[String(b.id)] ?? { video: 1, reading: 0, quiz: 0 };
            return getCourseRecommendationScore(mixB, preferences) - getCourseRecommendationScore(mixA, preferences);
          });
        }
        break;
      case 'recent':
      default:
        break;
    }

    return filtered;
  };

  const filteredCourses = getFilteredCourses();
  const publishedCoursesForPrograms = courses
    .filter((c) => c.status === 'published' && typeof c.id === 'string')
    .map((c) => ({ id: c.id as string, title: c.title, status: c.status, learners: c.learners }));
  const programsOnlyView = selectedFilter === 'programs';

  const toggleCourseSelection = (courseId: CourseId) => {
    setSelectedCourses(prev => 
      prev.includes(courseId) 
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleDeleteCourse = (course: CourseRow) => {
    setCourseToDelete(course);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!courseToDelete) return;
    const id = courseToDelete.id;
    if (typeof id === 'string') {
      try {
        const { error } = await supabase.from('courses').delete().eq('id', id);
        if (error) throw error;
      } catch {
        setShowDeleteModal(false);
        setCourseToDelete(null);
        return;
      }
    }
    setCourses(courses.filter(c => c.id !== id));
    setShowDeleteModal(false);
    setCourseToDelete(null);
    setSelectedCourses(prev => prev.filter(x => x !== id));
  };

  const handleShareCourse = (course: CourseRow) => {
    setCourseToShare(course);
    setShareMagicLink(null);
    setShareMagicLinkError(null);
    setShareInviteEmails('');
    setShareInviteMessage('');
    setShareInviteError(null);
    setShareInviteSuccess(null);
    setShowShareModal(true);
  };

  useEffect(() => {
    if (!showShareModal || !courseToShare || typeof courseToShare.id !== 'string') return;
    setShareMagicLinkLoading(true);
    setShareMagicLinkError(null);
    fetch(`/api/courses/${encodeURIComponent(courseToShare.id)}/magic-link`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.magicLink) setShareMagicLink(data.magicLink);
        else setShareMagicLinkError(data.error || 'Could not create link');
      })
      .catch(() => setShareMagicLinkError('Could not create link'))
      .finally(() => setShareMagicLinkLoading(false));
  }, [showShareModal, courseToShare]);

  const handleDuplicateCourse = async (course: CourseRow) => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (typeof course.id !== 'string' || !userId) {
      setCourses([{ ...course, id: `copy-${Date.now()}`, title: `${course.title} (Copy)`, status: 'draft', learners: 0, enrolled: 0, views: 0, lastUpdated: 'Just now', createdDate: new Date().toLocaleDateString() }, ...courses]);
      return;
    }
    try {
      const newRes = await fetch('/api/instructor/courses/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: `${course.title} (Copy)`,
          description: course.description ?? '',
        }),
      });
      if (!newRes.ok) {
        const errData = await newRes.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || newRes.statusText || 'Failed to create copy');
      }
      const { id: newId } = (await newRes.json()) as { id?: string };
      if (!newId) throw new Error('No course id from server');
      const { data: newRow, error: selErr } = await (supabase as any)
        .from('courses')
        .select('id, title, description, status, created_at, updated_at')
        .eq('id', newId)
        .single();
      if (selErr || !newRow) throw selErr || new Error('Could not load new course');
      const newCourse: CourseRow = {
        id: (newRow as { id: string }).id,
        title: (newRow as { title: string }).title,
        description: (newRow as { description: string | null })?.description ?? '',
        thumbnail: 'blue',
        modules: 0,
        lessons: 0,
        learners: 0,
        enrolled: 0,
        completion: 0,
        avgRating: 0,
        totalRatings: 0,
        status: 'draft',
        category: 'General',
        duration: '0m',
        lastUpdated: formatCourseDate((newRow as { updated_at: string }).updated_at),
        createdDate: formatCourseDate((newRow as { created_at: string }).created_at),
        views: 0,
        trend: 'up',
        trendValue: 0,
        hasQuiz: false,
        hasCertificate: false,
        language: 'English',
        level: 'Beginner',
        tags: []
      };
      setCourses([newCourse, ...courses]);
    } catch {
      setCourses([{ ...course, id: `copy-${Date.now()}`, title: `${course.title} (Copy)`, status: 'draft', learners: 0, enrolled: 0, views: 0, lastUpdated: 'Just now', createdDate: new Date().toLocaleDateString() }, ...courses]);
    }
  };

  const openCollaboratorsModal = (course: CourseRow) => {
    setCourseForCollaborators(course);
    setShowCollaboratorsModal(true);
    setCollaboratorsList([]);
    setCourseOwnerId(typeof course.createdBy === 'string' ? course.createdBy : null);
    setInviteEmail('');
    setInviteError(null);
    setInviteSuccess(null);
    setActiveDropdown(null);
  };

  useEffect(() => {
    if (!showCollaboratorsModal || !courseForCollaborators || typeof courseForCollaborators.id !== 'string') return;
    const courseId = courseForCollaborators.id;
    setCollaboratorsLoading(true);
    (async () => {
      try {
        const { data: courseRow } = await supabase.from('courses').select('created_by').eq('id', courseId).maybeSingle();
        const fetchedOwnerId = (courseRow as { created_by?: string } | null)?.created_by ?? null;
        const effectiveOwnerId =
          fetchedOwnerId ??
          (typeof courseForCollaborators.createdBy === 'string' ? courseForCollaborators.createdBy : null);
        setCourseOwnerId(effectiveOwnerId);
        const { data: collabRows } = await supabase.from('course_collaborators').select('user_id').eq('course_id', courseId);
        const userIds = Array.from(new Set([...(effectiveOwnerId ? [effectiveOwnerId] : []), ...(collabRows ?? []).map((r: { user_id: string }) => r.user_id)]));
        if (userIds.length === 0) {
          setCollaboratorsList(effectiveOwnerId ? [{ id: effectiveOwnerId, full_name: null, isOwner: true }] : []);
          return;
        }
        const { data: profiles } = await supabase.from('user_profiles').select('id, full_name, role').in('id', userIds);
        const map = new Map((profiles ?? []).map((p: { id: string; full_name: string | null; role?: string }) => [p.id, p]));
        const list = userIds
          .map((id) => {
            const p = map.get(id);
            return { id, full_name: p?.full_name ?? null, isOwner: id === effectiveOwnerId, role: p?.role };
          })
          .filter((c) => c.role !== 'admin');
        setCollaboratorsList(list);
      } catch {
        setCollaboratorsList([]);
      } finally {
        setCollaboratorsLoading(false);
      }
    })();
  }, [showCollaboratorsModal, courseForCollaborators]);

  const handleInviteCollaborator = async () => {
    if (!courseForCollaborators || typeof courseForCollaborators.id !== 'string' || !inviteEmail.trim()) return;
    setInviteError(null);
    setInviteSuccess(null);
    setInviteLoading(true);
    try {
      const res = await fetch('/api/courses/invite-collaborator', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: courseForCollaborators.id, email: inviteEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInviteError(data?.error ?? 'Failed to invite');
        return;
      }
      setInviteEmail('');
      setInviteSuccess(
        data.emailSent
          ? 'Co-instructor added and notified by email.'
          : 'Co-instructor added. Enable RESEND_API_KEY to send email notifications.'
      );
      const { data: collabRows } = await supabase.from('course_collaborators').select('user_id').eq('course_id', courseForCollaborators.id);
      const newIds = (collabRows ?? []).map((r: { user_id: string }) => r.user_id).filter((id) => !collaboratorsList.some((c) => c.id === id));
      if (newIds.length) {
        const { data: profiles } = await supabase.from('user_profiles').select('id, full_name, role').in('id', newIds);
        const visible = (profiles ?? []).filter((p: { role?: string }) => p.role !== 'admin');
        const map = new Map(visible.map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]));
        setCollaboratorsList((prev) => [...prev, ...newIds.filter((id) => map.has(id)).map((id) => ({ id, full_name: map.get(id) ?? null, isOwner: false }))]);
      }
    } catch {
      setInviteError('Request failed');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleShareInviteLearners = async () => {
    if (!courseToShare || typeof courseToShare.id !== 'string') return;
    const emails = parseInviteEmails(shareInviteEmails);
    if (emails.length === 0) {
      setShareInviteError('Enter at least one valid email address.');
      setShareInviteSuccess(null);
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      setShareInviteError('Sign in to send invitations.');
      return;
    }
    setShareInviteLoading(true);
    setShareInviteError(null);
    setShareInviteSuccess(null);
    const courseId = courseToShare.id;
    const rows = emails.map((email) => ({
      email,
      course_id: courseId,
      status: 'pending' as const,
      created_by: session.user.id,
    }));
    const { error } = await (supabase as any).from('learner_invites').insert(rows);
    if (error) {
      setShareInviteLoading(false);
      setShareInviteError('Could not save invites. Ensure learner_invites table exists.');
      return;
    }
    try {
      const res = await fetch('/api/email/invite', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails,
          courseId,
          courseTitle: courseToShare.title,
          customMessage: shareInviteMessage.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        const failedNote = data.failed?.length ? ` (${data.failed.length} failed)` : '';
        setShareInviteSuccess(`Invites sent to ${data.sent ?? emails.length} recipient(s)${failedNote}.`);
        setShareInviteEmails('');
        setShareInviteMessage('');
      } else if (res.status === 503) {
        setShareInviteSuccess(`Saved ${emails.length} invite(s). Add RESEND_API_KEY in .env.production to send emails.`);
        setShareInviteEmails('');
        setShareInviteMessage('');
      } else {
        setShareInviteSuccess(`Saved ${emails.length} invite(s). ${data?.error || 'Email could not be sent.'}`);
        setShareInviteEmails('');
        setShareInviteMessage('');
      }
    } catch {
      setShareInviteSuccess(`Saved ${emails.length} invitation(s). Email delivery failed — try again later.`);
      setShareInviteEmails('');
      setShareInviteMessage('');
    } finally {
      setShareInviteLoading(false);
    }
  };

  const handleRemoveCollaborator = async (userIdToRemove: string) => {
    if (!courseForCollaborators || typeof courseForCollaborators.id !== 'string' || !userId) return;
    const effectiveOwnerId = resolveCourseOwnerId(courseForCollaborators, courseOwnerId);
    const isOwnerRow = effectiveOwnerId === userIdToRemove;
    if (isOwnerRow) return;
    const amOwner = effectiveOwnerId === userId;
    const canRemove = amOwner ? true : userIdToRemove === userId;
    if (!canRemove) return;
    try {
      const { error } = await supabase.from('course_collaborators').delete().eq('course_id', courseForCollaborators.id).eq('user_id', userIdToRemove);
      if (error) throw error;
      setCollaboratorsList((prev) => prev.filter((c) => c.id !== userIdToRemove));
      if (userIdToRemove === userId) {
        setShowCollaboratorsModal(false);
        setCourseForCollaborators(null);
      }
    } catch {
      setInviteError('Could not remove collaborator');
    }
  };

  const handleArchiveCourse = async (courseId: CourseId) => {
    if (typeof courseId === 'string') {
      try {
        const { error } = await (supabase as any).from('courses').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', courseId);
        if (error) throw error;
      } catch {
        return;
      }
    }
    setCourses(courses.map(c => 
      c.id === courseId ? { ...c, status: 'archived' } : c
    ));
  };

  const handlePreviewCourse = (course: CourseRow) => {
    if (typeof course.id === 'string' && onStartCourse) {
      onStartCourse(course.id);
      return;
    }
    if (typeof course.id === 'string') {
      window.open(`${window.location.origin}/course/${course.id}`, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenAnalytics = () => setCurrentView('analytics');

  const exportCourseCsv = (course: CourseRow) => {
    downloadCsv(
      `course-${course.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
      ['Field', 'Value'],
      [
        ['Title', course.title],
        ['Status', course.status],
        ['Modules', course.modules],
        ['Lessons', course.lessons ?? ''],
        ['Learners', course.learners],
        ['Completion %', course.completion],
        ['Duration', course.duration],
        ['Last updated', course.lastUpdated],
      ],
    );
  };

  const exportAllCoursesCsv = () => {
    downloadCsv(
      `my-courses-${new Date().toISOString().slice(0, 10)}`,
      ['Title', 'Status', 'Modules', 'Learners', 'Completion %', 'Duration', 'Last updated'],
      courses.map((c) => [c.title, c.status, c.modules, c.learners, c.completion, c.duration, c.lastUpdated]),
    );
  };

  const handleBulkShare = () => {
    const first = courses.find((c) => selectedCourses.includes(c.id));
    if (first) handleShareCourse(first);
  };

  const handleBulkArchive = async () => {
    for (const id of selectedCourses) {
      await handleArchiveCourse(id);
    }
    setSelectedCourses([]);
  };

  const handleBulkDelete = async () => {
    if (selectedCourses.length === 0) return;
    if (!window.confirm(`Delete ${selectedCourses.length} course(s)? This cannot be undone.`)) return;
    for (const id of selectedCourses) {
      if (typeof id === 'string') {
        try {
          await supabase.from('courses').delete().eq('id', id);
        } catch {
          // continue with remaining
        }
      }
    }
    setCourses((prev) => prev.filter((c) => !selectedCourses.includes(c.id)));
    setSelectedCourses([]);
  };

  const totalEnrollments = courses.reduce((acc, c) => acc + c.learners, 0);
  const totalCompletionSum = courses.reduce((acc, c) => acc + c.completion * c.learners, 0);
  const statsData = {
    total: courses.length,
    published: courses.filter(c => c.status === 'published').length,
    draft: courses.filter(c => c.status === 'draft').length,
    totalLearners: totalUniqueLearners ?? totalEnrollments,
    avgCompletion: totalEnrollments > 0 ? Math.round(totalCompletionSum / totalEnrollments) : 0
  };

  type EnrollmentStage = 'enrolled' | 'in_progress' | 'completed';
  const getEnrollmentStage = (c: EnrolledCourse): EnrollmentStage => {
    const p = c.progress_percentage ?? 0;
    if (p >= 100 || !!c.completed_at) return 'completed';
    if (p > 0) return 'in_progress';
    return 'enrolled';
  };

  const learnerStats = {
    enrolled: enrolledCourses.filter(c => getEnrollmentStage(c) === 'enrolled').length,
    inProgress: enrolledCourses.filter(c => getEnrollmentStage(c) === 'in_progress').length,
    completed: enrolledCourses.filter(c => getEnrollmentStage(c) === 'completed').length,
    avgCompletion: enrolledCourses.length
      ? Math.round(enrolledCourses.reduce((acc, c) => acc + (c.progress_percentage ?? 0), 0) / enrolledCourses.length)
      : 0
  };

  const getStageLabel = (stage: EnrollmentStage) => stage === 'enrolled' ? 'Enrolled' : stage === 'in_progress' ? 'In progress' : 'Completed';
  const getStageButtonLabel = (stage: EnrollmentStage) => stage === 'enrolled' ? 'Start' : stage === 'in_progress' ? 'Continue' : 'Retake';

  const getFilteredEnrolled = (): EnrolledCourse[] => {
    let list = enrolledCourses;
    if (learnerSearch.trim()) {
      const q = learnerSearch.toLowerCase();
      list = list.filter(c => c.title.toLowerCase().includes(q));
    }
    if (learnerFilter === 'enrolled') {
      list = list.filter(c => getEnrollmentStage(c) === 'enrolled');
    } else if (learnerFilter === 'in_progress') {
      list = list.filter(c => getEnrollmentStage(c) === 'in_progress');
    } else if (learnerFilter === 'completed') {
      list = list.filter(c => getEnrollmentStage(c) === 'completed');
    }
    const sorted = [...list];
    if (learnerSort === 'name') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (learnerSort === 'progress') sorted.sort((a, b) => (b.progress_percentage ?? 0) - (a.progress_percentage ?? 0));
    return sorted;
  };

  const filteredEnrolled = getFilteredEnrolled();

  const openRateModal = (c: EnrolledCourse) => {
    setRateModalCourse(c);
    setRateModalRating(c.my_rating ?? 0);
    setRateModalReview(c.my_review ?? '');
    setRateError(null);
  };

  const submitRate = async () => {
    if (!rateModalCourse || rateModalRating < 1 || rateModalRating > 5) return;
    setRateSubmitting(true);
    setRateError(null);
    try {
      const res = await fetch(`/api/learning/courses/${rateModalCourse.course_id}/rating`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: rateModalRating, review: rateModalReview.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRateError(data?.error ?? 'Failed to submit rating');
        return;
      }
      setRateModalCourse(null);
      fetch('/api/learning/enrolled', { credentials: 'include', cache: 'no-store' })
        .then((res) => res.json().catch(() => ({ courses: [] })))
        .then((data) => setEnrolledCourses(Array.isArray(data.courses) ? data.courses : []));
    } catch {
      setRateError('Failed to submit rating');
    } finally {
      setRateSubmitting(false);
    }
  };

  if (isLearnerView) {
    return (
      <div>
        <div className="bg-surface border-b border-line px-8 py-6 sticky top-0 z-20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-content">My learning</h1>
              <p className="text-content-secondary mt-1">Your enrolled courses. Continue where you left off.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <ThemeStatCard icon={BookOpen} title="Enrolled" value={learnerStats.enrolled} variant="info" />
            <ThemeStatCard icon={Clock} title="In progress" value={learnerStats.inProgress} variant="warning" />
            <ThemeStatCard icon={CheckCircle} title="Completed" value={learnerStats.completed} variant="success" />
            <ThemeStatCard icon={TrendingUp} title="Avg. completion" value={`${learnerStats.avgCompletion}%`} variant="warning" />
          </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <ThemeFilterTab active={learnerFilter === 'all'} onClick={() => setLearnerFilter('all')}>
                All ({enrolledCourses.length})
              </ThemeFilterTab>
              <ThemeFilterTab active={learnerFilter === 'enrolled'} onClick={() => setLearnerFilter('enrolled')}>
                Enrolled ({learnerStats.enrolled})
              </ThemeFilterTab>
              <ThemeFilterTab active={learnerFilter === 'in_progress'} onClick={() => setLearnerFilter('in_progress')}>
                In progress ({learnerStats.inProgress})
              </ThemeFilterTab>
              <ThemeFilterTab active={learnerFilter === 'completed'} onClick={() => setLearnerFilter('completed')}>
                Completed ({learnerStats.completed})
              </ThemeFilterTab>
            </div>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search courses..."
                  value={learnerSearch}
                  onChange={(e) => setLearnerSearch(e.target.value)}
                  className="app-input pl-10 w-56"
                />
              </div>
              <select
                value={learnerSort}
                onChange={(e) => setLearnerSort(e.target.value as 'recent' | 'name' | 'progress')}
                className="app-input font-semibold w-auto"
              >
                <option value="recent">Most recent</option>
                <option value="name">Name (A–Z)</option>
                <option value="progress">Progress</option>
              </select>
              <div className="flex bg-raised rounded-lg p-1">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded transition-all ${viewMode === 'grid' ? 'surface-1 shadow-sm' : 'hover:bg-overlay'}`}>
                  <Grid className="w-5 h-5 text-content-secondary" />
                </button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded transition-all ${viewMode === 'list' ? 'surface-1 shadow-sm' : 'hover:bg-overlay'}`}>
                  <List className="w-5 h-5 text-content-secondary" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="p-8">
          {enrolledLoading ? (
            <div className="text-center py-16 text-content-muted">Loading your courses…</div>
          ) : filteredEnrolled.length === 0 ? (
            <div className="text-center py-16 app-card rounded-lg border-2 border-dashed border-line">
              <BookOpen className="w-20 h-20 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-content mb-2">No courses found</h3>
              <p className="text-content-secondary mb-6">
                {learnerSearch ? `No courses match "${learnerSearch}"` : 'When you’re invited to a course, it will appear here.'}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredEnrolled.map((c) => {
                const stage = getEnrollmentStage(c);
                const modules = c.module_count ?? 0;
                const durationStr = formatCourseDuration(c.duration_seconds ?? 0);
                const avgRating = c.avg_rating;
                const totalRatings = c.total_ratings ?? 0;
                const myRating = c.my_rating;
                const lastUpdated = c.updated_at ? formatCourseDate(c.updated_at) : null;
                return (
                  <div key={c.id} className="app-card rounded-lg overflow-hidden hover:shadow-xl transition-all group">
                    <div className="c-course-thumb h-36">
                      <Video className="w-12 h-12 thumb-icon opacity-60" />
                      <span className={enrollmentStageBadge(stage)}>
                        {getStageLabel(stage)}
                      </span>
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold text-lg mb-3 line-clamp-1 text-content">{c.title}</h3>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
                        <div className="flex items-center text-sm text-content-secondary">
                          <BookOpen className="w-4 h-4 mr-2 flex-shrink-0" />
                          <span>{modules} module{modules !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center text-sm text-content-secondary">
                          <Clock className="w-4 h-4 mr-2 flex-shrink-0" />
                          <span>{durationStr}</span>
                        </div>
                        <div className="flex items-center text-sm">
                          <Star className={`w-4 h-4 mr-1 flex-shrink-0 ${(avgRating ?? 0) > 0 ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300 dark:text-gray-500'}`} />
                          <span className="font-semibold text-content">{avgRating != null && avgRating > 0 ? avgRating.toFixed(1) : 'N/A'}</span>
                          {totalRatings > 0 && <span className="text-content-muted ml-1 text-xs">({totalRatings})</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => openRateModal(c)}
                          className="flex items-center text-sm text-brand hover:underline justify-start"
                        >
                          {myRating != null ? 'Update rating' : 'Rate course'}
                        </button>
                      </div>
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-content-secondary">My progress</span>
                          <span className="font-semibold text-content">{c.progress_percentage ?? 0}%</span>
                        </div>
                        <div className="w-full c-progress h-2">
                          <div
                            className={`c-progress-fill h-2 ${
                              stage === 'completed' ? 'ok' : stage === 'in_progress' ? 'warn' : ''
                            }`}
                            style={{ width: `${Math.min(100, c.progress_percentage ?? 0)}%` }}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => onStartCourse?.(c.course_id)}
                        className="w-full c-btn c-btn-primary text-base font-semibold"
                      >
                        {getStageButtonLabel(stage)}
                        <Play className="w-4 h-4" />
                      </button>
                      {lastUpdated && (
                        <p className="text-xs text-content-muted mt-3">Updated {lastUpdated}</p>
                      )}
                      {c.my_review && (
                        <p className="text-xs text-content-muted mt-1 line-clamp-2">Your review: {c.my_review}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="app-card rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="c-table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Modules</th>
                      <th>Duration</th>
                      <th>Rating</th>
                      <th>Progress</th>
                      <th>Updated</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEnrolled.map((c) => (
                      <tr key={c.id} className="hover:bg-overlay/50">
                        <td className="px-6 py-4">
                          <span className="font-medium text-content">{c.title}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-content-secondary">{c.module_count ?? 0}</td>
                        <td className="px-6 py-4 text-sm text-content-secondary">{formatCourseDuration(c.duration_seconds ?? 0)}</td>
                        <td className="px-6 py-4">
                          <button type="button" onClick={() => openRateModal(c)} className="flex items-center gap-1 text-sm text-brand hover:underline">
                            <Star className={`w-4 h-4 ${(c.avg_rating ?? 0) > 0 ? 'text-yellow-500 fill-yellow-500' : ''}`} />
                            {(c.avg_rating ?? 0) > 0 ? c.avg_rating!.toFixed(1) : 'Rate'}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, c.progress_percentage ?? 0)}%` }} />
                            </div>
                            <span className="text-sm font-medium text-content-secondary">{c.progress_percentage ?? 0}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-content-muted">{c.updated_at ? formatCourseDate(c.updated_at) : '—'}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => openRateModal(c)} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-content-secondary hover:bg-overlay" title="Rate & review">
                              <Star className="w-4 h-4" />
                            </button>
                            <button onClick={() => onStartCourse?.(c.course_id)} className="c-btn c-btn-primary text-base font-semibold">
                              {getStageButtonLabel(getEnrollmentStage(c))}
                              <Play className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Rate & review modal */}
        {rateModalCourse && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !rateSubmitting && setRateModalCourse(null)}>
            <div className="app-card rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-content mb-1">Rate this course</h3>
              <p className="text-sm text-content-muted mb-4 line-clamp-1">{rateModalCourse.title}</p>
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRateModalRating(star)}
                    className="p-1 rounded hover:opacity-80 transition-opacity"
                    aria-label={`${star} star${star !== 1 ? 's' : ''}`}
                  >
                    <Star className={`w-8 h-8 ${rateModalRating >= star ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300 dark:text-gray-500'}`} />
                  </button>
                ))}
              </div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Review (optional)</label>
              <textarea
                value={rateModalReview}
                onChange={(e) => setRateModalReview(e.target.value)}
                placeholder="Share your experience…"
                rows={3}
                maxLength={2000}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 text-sm resize-none mb-4"
              />
              {rateError && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{rateError}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => !rateSubmitting && setRateModalCourse(null)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-content-secondary hover:bg-overlay">
                  Cancel
                </button>
                <button type="button" onClick={submitRate} disabled={rateSubmitting || rateModalRating < 1} className="c-btn c-btn-primary disabled:opacity-50">
                  {rateSubmitting ? 'Saving…' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-full bg-canvas">
      {/* Header */}
      <div className="bg-surface border-b border-line px-8 py-6 sticky top-0 z-20">
        {configMissing && (
          <div className="mb-4 text-sm text-amber-700 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2">
            Configure Supabase (see BACKEND_SETUP.md) to load and save courses.
          </div>
        )}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-content">My Courses</h1>
            <p className="text-content-secondary mt-1">Manage and organize your learning content</p>
          </div>
          <div className={pageHeaderActions}>
            <button
              type="button"
              onClick={() => setProgramCreateRequested(true)}
              className={headerSecondaryBtn}
            >
              <Layers className="w-5 h-5" />
              New Program
            </button>
            <button
              onClick={openCreateCourse}
              className={headerPrimaryBtn}
            >
              <Plus className="w-5 h-5" />
              Create New Course
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-4">
          <ThemeStatCard icon={Video} title="Total Courses" value={statsData.total} variant="info" />
          <ThemeStatCard icon={CheckCircle} title="Published" value={statsData.published} variant="success" />
          <ThemeStatCard icon={Edit} title="Drafts" value={statsData.draft} variant="warning" />
          <ThemeStatCard icon={Users} title="Total Learners" value={statsData.totalLearners} variant="neutral" />
          <ThemeStatCard icon={TrendingUp} title="Avg. Completion" value={`${statsData.avgCompletion}%`} variant="warning" />
        </div>

        {/* Filters and Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 flex-wrap">
            <ThemeFilterTab active={selectedFilter === 'all'} onClick={() => setSelectedFilter('all')}>
              All ({courses.length})
            </ThemeFilterTab>
            <ThemeFilterTab active={selectedFilter === 'published'} onClick={() => setSelectedFilter('published')}>
              Published ({courses.filter(c => c.status === 'published').length})
            </ThemeFilterTab>
            <ThemeFilterTab active={selectedFilter === 'draft'} onClick={() => setSelectedFilter('draft')}>
              Drafts ({courses.filter(c => c.status === 'draft').length})
            </ThemeFilterTab>
            <ThemeFilterTab active={selectedFilter === 'programs'} onClick={() => setSelectedFilter('programs')}>
              Programs ({programCount})
            </ThemeFilterTab>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search courses..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-surface text-content rounded-lg w-64 focus:ring-2 focus:ring-brand focus:border-transparent"
              />
            </div>

            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-surface text-content rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent font-semibold"
            >
              <option value="recent">Most Recent</option>
              <option value="recommended">Recommended for you</option>
              <option value="name">Name (A-Z)</option>
              <option value="learners">Most Learners</option>
              <option value="completion">Highest Completion</option>
            </select>

            <div className="flex bg-raised rounded-lg p-1">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-all ${
                  viewMode === 'grid' ? 'surface-1 shadow-sm' : 'hover:bg-overlay'
                }`}
              >
                <Grid className="w-5 h-5 text-content-secondary" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-all ${
                  viewMode === 'list' ? 'surface-1 shadow-sm' : 'hover:bg-overlay'
                }`}
              >
                <List className="w-5 h-5 text-content-secondary" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Courses Grid/List */}
      <div className="p-8">
        <CourseProgramSection
          publishedCourses={publishedCoursesForPrograms}
          userId={userId}
          searchQuery={searchQuery}
          programsOnly={false}
          showCards={false}
          createRequested={programCreateRequested}
          onCreateHandled={() => setProgramCreateRequested(false)}
          onProgramsChange={setProgramCount}
        />
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="app-card rounded-lg overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-200 bg-raised" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-gray-200 bg-raised rounded w-3/4" />
                  <div className="h-4 bg-gray-200 bg-raised rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : programsOnlyView ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <CourseProgramSection
              publishedCourses={publishedCoursesForPrograms}
              userId={userId}
              searchQuery={searchQuery}
              programsOnly
              showCards
              onProgramsChange={setProgramCount}
            />
          </div>
        ) : filteredCourses.length === 0 && programCount === 0 ? (
          <div className="text-center py-16 bg-white bg-surface rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600">
            <Folder className="w-20 h-20 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2 text-content">No courses found</h3>
            <p className="text-content-secondary mb-6">
              {searchQuery 
                ? `No courses match "${searchQuery}"`
                : `No ${selectedFilter} courses yet`
              }
            </p>
            <button 
              onClick={openCreateCourse}
              className="c-btn c-btn-primary"
            >
              Create Your First Course
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <CourseProgramSection
              publishedCourses={publishedCoursesForPrograms}
              userId={userId}
              searchQuery={searchQuery}
              programsOnly={false}
              showCards
              onProgramsChange={setProgramCount}
            />
            {filteredCourses.map((course) => (
              <div 
                key={course.id}
                className="app-card rounded-lg overflow-hidden hover:shadow-xl transition-all group"
              >
                {/* Thumbnail */}
                <div className="c-course-thumb h-48">
                  <Video className="w-16 h-16 thumb-icon opacity-60" />
                  
                  <span className={courseStatusBadge(course.status)}>
                    {course.status.charAt(0).toUpperCase() + course.status.slice(1)}
                  </span>
                  {course.status === 'published' && course.hasUnpublishedChanges && (course.createdBy === userId || userRole === 'admin') && (
                    <span className="absolute bottom-4 left-4 c-badge c-badge-warn" title="Republish to release latest to learners">Unpublished changes</span>
                  )}

                  {/* Quick Actions */}
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleShareCourse(course)}
                      className={thumbOverlayIconBtn}
                      title="Share course"
                    >
                      <Share2 />
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdown(activeDropdown === course.id ? null : course.id);
                        }}
                        className={thumbOverlayIconBtn}
                        title="More actions"
                      >
                        <MoreVertical />
                      </button>

                      {activeDropdown === course.id && (
                        <div className="absolute right-0 mt-2 w-48 app-card rounded-lg shadow-2xl border border-line py-2 z-30">
                          <button 
                            onClick={() => {
                              handleDuplicateCourse(course);
                              setActiveDropdown(null);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-overlay flex items-center text-sm text-content-secondary"
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicate
                          </button>
                          <button 
                            onClick={() => {
                              handleArchiveCourse(course.id);
                              setActiveDropdown(null);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-overlay flex items-center text-sm text-content-secondary"
                          >
                            <Archive className="w-4 h-4 mr-2" />
                            Archive
                          </button>
                          <button 
                            onClick={() => { openCollaboratorsModal(course); }}
                            className="w-full px-4 py-2 text-left hover:bg-overlay flex items-center text-sm text-content-secondary"
                          >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Collaborators
                          </button>
                          <button 
                            onClick={() => {
                              exportCourseCsv(course);
                              setActiveDropdown(null);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-overlay flex items-center text-sm text-content-secondary"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Export
                          </button>
                          <hr className="my-2 dark:border-gray-600" />
                          <button 
                            onClick={() => {
                              handleDeleteCourse(course);
                              setActiveDropdown(null);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center text-sm text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="mb-4">
                    <h3 className="font-bold text-lg mb-2 line-clamp-1 text-content">{course.title}</h3>
                    <p className="text-sm text-content-secondary line-clamp-2">{course.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="flex items-center text-sm text-content-secondary">
                      <BookOpen className="w-4 h-4 mr-2" />
                      <span>{course.modules} modules</span>
                    </div>
                    <div className="flex items-center text-sm text-content-secondary">
                      <Users className="w-4 h-4 mr-2" />
                      <span>{course.learners} learners</span>
                    </div>
                    <div className="flex items-center text-sm text-content-secondary">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>{course.duration}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Star className="w-4 h-4 mr-1 text-yellow-500 fill-yellow-500" />
                      <span className="font-semibold text-content">{course.avgRating || 'N/A'}</span>
                      {course.totalRatings > 0 && (
                        <span className="text-content-secondary ml-1">({course.totalRatings})</span>
                      )}
                    </div>
                  </div>

                  {course.completion > 0 && (
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-content-secondary">Avg. Completion</span>
                        <span className="font-semibold flex items-center">
                          {course.completion}%
                          {course.trend === 'up' ? (
                            <TrendingUp className="w-4 h-4 ml-1 text-green-600" />
                          ) : (
                            <TrendingDown className="w-4 h-4 ml-1 text-red-600" />
                          )}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${
                            course.completion >= 80 ? 'bg-green-500' :
                            course.completion >= 50 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{width: `${course.completion}%`}}
                        ></div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mb-4">
                    {course.tags.slice(0, 2).map((tag, idx) => (
                      <span key={idx} className="text-xs bg-raised text-content-secondary px-2 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                    {course.tags.length > 2 && (
                      <span className="text-xs bg-raised text-content-secondary px-2 py-1 rounded-full">
                        +{course.tags.length - 2}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => { if (typeof course.id === 'string' && onEditCourse) onEditCourse(course.id); else openCreateCourse(); }}
                      className={`flex-1 c-btn c-btn-sm ${
                        course.status === 'published' ? 'c-btn-accent' : 'c-btn-ghost'
                      }`}
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePreviewCourse(course)}
                      className={iconBtn}
                      title="Preview course"
                    >
                      <Eye />
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenAnalytics}
                      className={iconBtn}
                      title="View analytics"
                    >
                      <BarChart3 />
                    </button>
                  </div>

                  <div className="mt-4 pt-4 border-t border-line flex items-center justify-between text-xs text-content-muted">
                    <span>Updated {course.lastUpdated}</span>
                    <div className="flex items-center space-x-2">
                      {course.hasQuiz && (
                        <div className="flex items-center text-blue-600" title="Has Quiz">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                      )}
                      {course.hasCertificate && (
                        <div className="flex items-center text-purple-600" title="Certificate Available">
                          <Award className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="app-card rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 bg-raised border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="px-6 py-4 text-left">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 dark:border-gray-500"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCourses(filteredCourses.map(c => c.id));
                          } else {
                            setSelectedCourses([]);
                          }
                        }}
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-content-secondary">Course</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-content-secondary">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-content-secondary">Learners</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-content-secondary">Completion</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-content-secondary">Rating</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-content-secondary">Last Updated</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-content-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredCourses.map((course) => (
                    <tr key={course.id} className="hover:bg-overlay/50 transition-all">
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox"
                          checked={selectedCourses.includes(course.id)}
                          onChange={() => toggleCourseSelection(course.id)}
                          className="rounded border-gray-300 dark:border-gray-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-12 h-12 bg-info-subtle border border-line rounded-lg flex items-center justify-center mr-4">
                            <Video className="w-6 h-6 text-info" />
                            <Video className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-content">{course.title}</p>
                            <p className="text-xs text-content-secondary">{course.modules} modules • {course.duration}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`c-badge ${course.status === 'published' ? 'c-badge-published' : course.status === 'draft' ? 'c-badge-draft' : 'c-badge-mute'}`}>
                            {course.status.charAt(0).toUpperCase() + course.status.slice(1)}
                          </span>
                          {course.status === 'published' && course.hasUnpublishedChanges && (course.createdBy === userId || userRole === 'admin') && (
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium" title="Republish to release latest version to learners">Unpublished changes</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <Users className="w-4 h-4 mr-2 text-content-secondary" />
                          <span className="font-semibold text-content">{course.learners}</span>
                          <span className="text-content-secondary text-sm ml-1">/ {course.enrolled}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                course.completion >= 80 ? 'bg-green-500' :
                                course.completion >= 50 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{width: `${course.completion}%`}}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold text-content">{course.completion}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 mr-1" />
                          <span className="font-semibold text-content">{course.avgRating || 'N/A'}</span>
                          {course.totalRatings > 0 && (
                            <span className="text-content-secondary text-sm ml-1">({course.totalRatings})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-content-secondary">{course.lastUpdated}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => { if (typeof course.id === 'string' && onEditCourse) onEditCourse(course.id); else openCreateCourse(); }}
                            className="p-2 hover:bg-overlay rounded-lg transition-all" 
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-content-secondary" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePreviewCourse(course)}
                            className="p-2 hover:bg-overlay rounded-lg transition-all"
                            title="Preview course"
                          >
                            <Eye className="w-4 h-4 text-content-secondary" />
                          </button>
                          <button
                            type="button"
                            onClick={handleOpenAnalytics}
                            className="p-2 hover:bg-overlay rounded-lg transition-all"
                            title="View analytics"
                          >
                            <BarChart3 className="w-4 h-4 text-content-secondary" />
                          </button>
                          <div className="relative">
                            <button 
                              onClick={() => setActiveDropdown(activeDropdown === course.id ? null : course.id)}
                              className="p-2 hover:bg-overlay rounded-lg transition-all"
                            >
                              <MoreVertical className="w-4 h-4 text-content-secondary" />
                            </button>
                            {activeDropdown === course.id && (
                              <div className="absolute right-0 mt-2 w-48 app-card rounded-lg shadow-2xl border border-line py-2 z-30">
                                <button 
                                  onClick={() => {
                                    handleShareCourse(course);
                                    setActiveDropdown(null);
                                  }}
                                  className="w-full px-4 py-2 text-left hover:bg-overlay flex items-center text-sm text-content-secondary"
                                >
                                  <Share2 className="w-4 h-4 mr-2" />
                                  Share
                                </button>
                                <button 
                                  onClick={() => {
                                    handleDuplicateCourse(course);
                                    setActiveDropdown(null);
                                  }}
                                  className="w-full px-4 py-2 text-left hover:bg-overlay flex items-center text-sm text-content-secondary"
                                >
                                  <Copy className="w-4 h-4 mr-2" />
                                  Duplicate
                                </button>
                                <button 
                                  onClick={() => { openCollaboratorsModal(course); setActiveDropdown(null); }}
                                  className="w-full px-4 py-2 text-left hover:bg-overlay flex items-center text-sm text-content-secondary"
                                >
                                  <UserPlus className="w-4 h-4 mr-2" />
                                  Collaborators
                                </button>
                                <button 
                                  onClick={() => {
                                    exportCourseCsv(course);
                                    setActiveDropdown(null);
                                  }}
                                  className="w-full px-4 py-2 text-left hover:bg-overlay flex items-center text-sm text-content-secondary"
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Export
                                </button>
                                <hr className="my-2 dark:border-gray-600" />
                                <button 
                                  onClick={() => {
                                    handleDeleteCourse(course);
                                    setActiveDropdown(null);
                                  }}
                                  className="w-full px-4 py-2 text-left hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center text-sm text-red-600 dark:text-red-400"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bulk Actions Bar */}
        {selectedCourses.length > 0 && (
          <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center space-x-4 z-50">
            <span className="font-semibold">{selectedCourses.length} selected</span>
            <div className="w-px h-6 bg-gray-600"></div>
            <button
              type="button"
              onClick={handleBulkShare}
              className="px-4 py-2 bg-blue-600 rounded-lg font-semibold flex items-center transition-all"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </button>
            <button
              type="button"
              onClick={handleBulkArchive}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold flex items-center transition-all"
            >
              <Archive className="w-4 h-4 mr-2" />
              Archive
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold flex items-center transition-all"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </button>
            <button 
              onClick={() => setSelectedCourses([])}
              className="p-2 hover:bg-gray-700 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && courseToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="app-card rounded-lg shadow-2xl max-w-md w-full mx-4 border border-line">
            <div className="p-6 border-b border-line">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-2xl font-bold text-center mb-2 text-content">Delete Course?</h3>
              <p className="text-content-secondary text-center">
                Are you sure you want to delete <span className="font-semibold text-content">&quot;{courseToDelete.title}&quot;</span>? This action cannot be undone.
              </p>
            </div>
            <div className="p-6">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
                <p className="text-sm text-red-900 dark:text-red-200">
                  <span className="font-semibold">Warning:</span> Deleting this course will also remove:
                </p>
                <ul className="list-disc list-inside text-sm text-red-800 dark:text-red-300 mt-2 space-y-1">
                  <li>All {courseToDelete.learners} learner enrollments</li>
                  <li>Progress data and completion records</li>
                  <li>All course content and videos</li>
                  <li>{courseToDelete.totalRatings} ratings and feedback</li>
                </ul>
              </div>
              <div className="flex space-x-3">
                <button 
                  onClick={() => {
                    setShowDeleteModal(false);
                    setCourseToDelete(null);
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-overlay font-semibold transition-all text-content-secondary"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold transition-all shadow-lg"
                >
                  Delete Course
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collaborators Modal */}
      {showCollaboratorsModal && courseForCollaborators && (() => {
        const effectiveOwnerId = resolveCourseOwnerId(courseForCollaborators, courseOwnerId);
        const showCollaboratorInvite = canInviteCollaborators(courseForCollaborators, userId, courseOwnerId);
        return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="app-card rounded-lg shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-line flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-content">Collaborators — {courseForCollaborators.title}</h3>
              <button
                type="button"
                onClick={() => { setShowCollaboratorsModal(false); setCourseForCollaborators(null); setInviteError(null); }}
                className="p-2 hover:bg-overlay rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {collaboratorsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <>
                  <ul className="space-y-2 mb-6">
                    {collaboratorsList.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 border-line last:border-0">
                        <span className="text-content font-medium truncate">
                          {c.full_name ?? 'Unknown'}
                          {c.isOwner && <span className="ml-2 text-xs text-content-muted">(Owner)</span>}
                        </span>
                        {!c.isOwner && (effectiveOwnerId === userId || c.id === userId) && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCollaborator(c.id)}
                            className="text-sm text-red-600 dark:text-red-400 hover:underline shrink-0"
                          >
                            {c.id === userId ? 'Leave' : 'Remove'}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {showCollaboratorInvite ? (
                    <div className="pt-4 border-t border-line">
                      <p className="text-sm font-semibold text-content-secondary mb-2">Invite co-instructor</p>
                      <p className="text-xs text-content-muted mb-3">They must already have a Coursify account with this email.</p>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          placeholder="Email address"
                          value={inviteEmail}
                          onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); }}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white bg-raised text-content placeholder-gray-500"
                        />
                        <button
                          type="button"
                          onClick={handleInviteCollaborator}
                          disabled={inviteLoading || !inviteEmail.trim()}
                          className="c-btn c-btn-primary disabled:opacity-50 shrink-0"
                        >
                          {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                          Invite
                        </button>
                      </div>
                      {inviteSuccess && <p className="text-sm text-green-600 dark:text-green-400 mt-2">{inviteSuccess}</p>}
                      {inviteError && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{inviteError}</p>}
                    </div>
                  ) : (
                    <p className="text-xs text-content-muted pt-4 border-t border-line">
                      Only the course owner can invite co-instructors.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {/* Share Modal */}
      {showShareModal && courseToShare && (() => {
        const baseUrl = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_APP_URL || window.location.origin) : '';
        const fallbackCourseUrl = `${baseUrl}/course/${courseToShare.id}`;
        const displayUrl = shareMagicLink || fallbackCourseUrl;
        const courseTitle = courseToShare.title || 'Course';

        const handleCopy = async () => {
          try {
            await navigator.clipboard.writeText(displayUrl);
            setShareCopyFeedback(true);
            setTimeout(() => setShareCopyFeedback(false), 2000);
          } catch {
            const input = document.createElement('input');
            input.value = displayUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setShareCopyFeedback(true);
            setTimeout(() => setShareCopyFeedback(false), 2000);
          }
        };

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="app-card rounded-lg shadow-2xl max-w-lg w-full mx-4 border border-line">
              <div className="p-6 border-b border-line flex items-center justify-between">
                <h3 className="text-2xl font-bold text-content">Share Course</h3>
                <button 
                  onClick={() => {
                    setShowShareModal(false);
                    setCourseToShare(null);
                    setShareCopyFeedback(false);
                    setShareMagicLink(null);
                    setShareMagicLinkError(null);
                    setShareInviteEmails('');
                    setShareInviteError(null);
                    setShareInviteSuccess(null);
                  }}
                  className="p-2 hover:bg-overlay rounded-lg transition-all"
                >
                  <X className="w-6 h-6 text-content-secondary" />
                </button>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <p className="text-sm font-semibold mb-2 text-content-secondary">Share link (magic link)</p>
                  {shareMagicLinkError && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">{shareMagicLinkError}. Showing course link instead.</p>
                  )}
                  <div className="flex items-center space-x-2">
                    <input 
                      type="text" 
                      value={shareMagicLinkLoading ? 'Loading…' : displayUrl}
                      readOnly
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 bg-raised text-content"
                    />
                    <button 
                      type="button"
                      onClick={handleCopy}
                      disabled={shareMagicLinkLoading}
                      className="c-btn c-btn-primary shrink-0 disabled:opacity-70"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      {shareCopyFeedback ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="mb-6 pt-6 border-t border-line">
                  <p className="text-sm font-semibold mb-2 text-content-secondary flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Invite learners by email
                  </p>
                  <p className="text-xs text-content-muted mb-3">
                    Sends an invitation to enroll in <strong className="font-medium text-content-secondary">{courseTitle}</strong>. Learners sign in with the same email.
                  </p>
                  <label className="block text-xs font-semibold text-content-secondary mb-1.5">Personal message (optional)</label>
                  <textarea
                    value={shareInviteMessage}
                    onChange={(e) => { setShareInviteMessage(e.target.value); setShareInviteError(null); setShareInviteSuccess(null); }}
                    placeholder="Add a note for your learners — shown above the invitation card in the email."
                    rows={3}
                    className="w-full px-4 py-2 mb-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white bg-raised text-content placeholder-gray-500 text-sm"
                  />
                  <label className="block text-xs font-semibold text-content-secondary mb-1.5">Email addresses</label>
                  <textarea
                    value={shareInviteEmails}
                    onChange={(e) => { setShareInviteEmails(e.target.value); setShareInviteError(null); setShareInviteSuccess(null); }}
                    placeholder="email@example.com, one per line or comma-separated"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white bg-raised text-content placeholder-gray-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleShareInviteLearners}
                    disabled={shareInviteLoading || !shareInviteEmails.trim()}
                    className="mt-3 w-full c-btn c-btn-primary disabled:opacity-50"
                  >
                    {shareInviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    Send invitations
                  </button>
                  {shareInviteSuccess && <p className="text-sm text-green-600 dark:text-green-400 mt-2">{shareInviteSuccess}</p>}
                  {shareInviteError && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{shareInviteError}</p>}
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                  <div className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-900 dark:text-blue-200">
                      <p className="font-semibold mb-1">Course is Published</p>
                      <p>Learners can access this course immediately after enrolling.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default MyCourses;
