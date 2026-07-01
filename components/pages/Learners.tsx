'use client'

import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Clock, Search, Mail, Download, Upload, MoreVertical,
  CheckCircle, AlertCircle, TrendingUp, Target, Calendar, BookOpen, Star, Send, UserPlus, UserMinus,
  Activity, Trophy, FileDown, ArrowUpRight, ArrowDownRight, Zap, X, Play, FileText, Bell, Award, Eye, Loader2
} from 'lucide-react';
import { headerPrimaryBtn, headerSecondaryBtn, iconBtn, learnerStatusBadge, pageHeaderActions, primaryBtn } from '@/components/ui/theme-classes';
import { supabase } from '@/lib/supabase';
import { downloadCsv, openMailTo } from '@/lib/download-csv';
import { fetchJsonCached, readClientCache, SHELL_CACHE_MS } from '@/lib/client-fetch-cache';
import type { Database } from '@/lib/database.types';
import { ThemeAvatar, ThemeStatCard, ThemeFilterTab } from '@/components/ui/ThemeStatCard';

type CourseProgram = {
  id: string;
  title: string;
  description: string | null;
  courseIds: string[];
  courses: { id: string; title: string; order_index: number }[];
};

type LearnerInviteInsert = Database['public']['Tables']['learner_invites']['Insert'];

interface LearnersProps {
  setCurrentView: (view: string) => void;
}

type LearnerId = number | string;

type LearnerApiRow = {
  id: string;
  full_name?: string | null;
  role?: string;
  organization?: string | null;
  enrolledCourses?: number;
  completedCourses?: number;
  totalProgress?: number;
  lastActive?: string;
  joinedDate?: string;
  averageScore?: number;
  totalTimeSpent?: string;
  lastActivityAt?: string | null;
  email?: string | null;
  certificates?: number;
};

function mapLearnerRow(p: LearnerApiRow) {
  const name = p.full_name || 'Unknown';
  const initials = name.split(/\s+/).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const enrolledCourses = p.enrolledCourses ?? 0;
  const completedCourses = p.completedCourses ?? 0;
  const totalProgress = p.totalProgress ?? 0;
  const lastActivityAt = p.lastActivityAt ?? null;
  const daysSinceActivity = lastActivityAt
    ? Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / (24 * 60 * 60 * 1000))
    : 999;
  let status: 'active' | 'at-risk' | 'inactive' = 'active';
  if (enrolledCourses === 0) status = 'inactive';
  else if (daysSinceActivity > 7) status = 'inactive';
  else if ((totalProgress < 25 && daysSinceActivity >= 3) || (daysSinceActivity >= 3 && daysSinceActivity <= 7)) status = 'at-risk';
  else if (totalProgress >= 25 && daysSinceActivity <= 2) status = 'active';
  else if (totalProgress < 25 && daysSinceActivity <= 2) status = 'active';
  else status = 'at-risk';
  return {
    id: p.id,
    name,
    email: p.email ?? '(signed up)',
    avatar: initials,
    avatarColor: 'from-indigo-400 to-indigo-500',
    status,
    enrolledCourses,
    completedCourses,
    inProgressCourses: Math.max(0, enrolledCourses - completedCourses),
    totalProgress,
    averageScore: p.averageScore ?? 0,
    totalTimeSpent: p.totalTimeSpent ?? '0h',
    lastActive: p.lastActive ?? '—',
    joinedDate: p.joinedDate ?? '—',
    streak: 0,
    badges: 0,
    certificates: p.certificates ?? 0,
    department: p.organization || '—',
    role: p.role || '—',
    manager: '—',
    courses: [],
    activityLog: [],
  };
}

function initialLearnersState(): any[] {
  const cached = readClientCache<Record<string, unknown>>('instructor:learners', SHELL_CACHE_MS);
  const apiLearners = Array.isArray(cached?.learners) ? (cached!.learners as LearnerApiRow[]) : [];
  return apiLearners.map(mapLearnerRow);
}

const Learners: React.FC<LearnersProps> = ({ setCurrentView }) => {
  const [selectedTab, setSelectedTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showLearnerDetail, setShowLearnerDetail] = useState<any>(null);
  const [activeDropdown, setActiveDropdown] = useState<LearnerId | null>(null);
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviteCustomMessage, setInviteCustomMessage] = useState('');
  const [bulkUploadFile, setBulkUploadFile] = useState<File | null>(null);
  const [inviteCourseIds, setInviteCourseIds] = useState<string[]>([]);
  const [inviteProgramId, setInviteProgramId] = useState<string>('');
  const [coursePrograms, setCoursePrograms] = useState<CourseProgram[]>([]);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [programSaving, setProgramSaving] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [programTitle, setProgramTitle] = useState('');
  const [programDescription, setProgramDescription] = useState('');
  const [programCourseIds, setProgramCourseIds] = useState<string[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [learners, setLearners] = useState<any[]>(initialLearnersState);
  const [publishedCourses, setPublishedCourses] = useState<{ id: string; title: string }[]>([]);
  const [configMissing, setConfigMissing] = useState(false);
  const [learnersError, setLearnersError] = useState<string | null>(null);
  const [learnersEmptyReason, setLearnersEmptyReason] = useState<'no_courses' | 'no_enrollments' | null>(null);
  const [pendingInvites, setPendingInvites] = useState<{ id: string; email: string; course_id: string | null; status: string; created_at: string }[]>([]);
  const [inviteSending, setInviteSending] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(
    () => readClientCache<Record<string, unknown>>('instructor:learners', SHELL_CACHE_MS) == null
  );

  useEffect(() => {
    const tab = sessionStorage.getItem('learners-tab');
    if (tab === 'at-risk' || tab === 'active' || tab === 'inactive' || tab === 'all') {
      setSelectedTab(tab);
      sessionStorage.removeItem('learners-tab');
    }
  }, []);

  const stats = {
    total: learners.length,
    active: learners.filter(l => l.status === 'active').length,
    atRisk: learners.filter(l => l.status === 'at-risk').length,
    inactive: learners.filter(l => l.status === 'inactive').length,
    avgCompletion: learners.length ? Math.round(learners.reduce((acc, l) => acc + (l.totalProgress ?? 0), 0) / learners.length) : 0,
    avgScore: learners.length ? Math.round(learners.reduce((acc, l) => acc + (l.averageScore ?? 0), 0) / learners.length) : 0,
    totalCertificates: learners.reduce((acc, l) => acc + (l.certificates ?? 0), 0),
    totalTimeSpent: learners.length ? '—' : '0h'
  };

  const getFilteredLearners = () => {
    let filtered = learners;

    if (selectedTab !== 'all') {
      filtered = filtered.filter(l => l.status === selectedTab);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(l => 
        (l.name ?? '').toLowerCase().includes(q) ||
        (l.email ?? '').toLowerCase().includes(q) ||
        (l.department ?? '').toLowerCase().includes(q)
      );
    }

    switch(sortBy) {
      case 'name':
        filtered.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
        break;
      case 'progress':
        filtered.sort((a, b) => (b.totalProgress ?? 0) - (a.totalProgress ?? 0));
        break;
      case 'courses':
        filtered.sort((a, b) => (b.enrolledCourses ?? 0) - (a.enrolledCourses ?? 0));
        break;
      default:
        break;
    }

    return filtered;
  };

  const filteredLearners = getFilteredLearners();

  useEffect(() => {
    const applyLearnersPayload = async (payload: Record<string, unknown>) => {
      setLearnersError(null);
      if (payload.error && typeof payload.error === 'string') {
        const msg = payload.error;
        setLearnersError(msg === 'SUPABASE_SERVICE_ROLE_KEY required' ? 'Server config: add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart the dev server.' : msg);
        setLearners([]);
        setLearnersEmptyReason(null);
        return;
      }
      const apiLearners = Array.isArray(payload.learners) ? payload.learners : [];
      const emptyReason = payload.emptyReason as 'no_courses' | 'no_enrollments' | undefined;
      setLearnersEmptyReason(emptyReason ?? null);
      if (apiLearners.length > 0) {
        setLearnersEmptyReason(null);
        setLearners(apiLearners.map((p) => mapLearnerRow(p as LearnerApiRow)));
        return;
      }
      const userIds = Array.isArray(payload.userIds) ? (payload.userIds as string[]) : [];
      const learnerStatsFromApi = (payload.learnerStats && typeof payload.learnerStats === 'object')
        ? (payload.learnerStats as Record<string, Record<string, unknown>>)
        : {};
      if (userIds.length === 0) {
        setLearners([]);
        return;
      }
      setLearnersEmptyReason(null);
      const { data: profilesData, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, role, organization')
        .in('id', userIds);
      if (error) throw error;
      setLearners(
        (profilesData ?? []).map((p: { id: string; full_name: string | null; role: string; organization: string | null }) => {
          const stats = learnerStatsFromApi[p.id] ?? {};
          return mapLearnerRow({
            id: p.id,
            full_name: p.full_name,
            role: p.role,
            organization: p.organization,
            enrolledCourses: stats.enrolledCourses as number | undefined,
            completedCourses: stats.completedCourses as number | undefined,
            totalProgress: stats.totalProgress as number | undefined,
            lastActive: stats.lastActive as string | undefined,
            joinedDate: stats.joinedDate as string | undefined,
            averageScore: stats.averageScore as number | undefined,
            totalTimeSpent: stats.totalTimeSpent as string | undefined,
            lastActivityAt: stats.lastActivityAt as string | null | undefined,
            certificates: stats.certificates as number | undefined,
          });
        })
      );
    };

    const fetchProfiles = async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setConfigMissing(true);
        setLoading(false);
        return;
      }
      setConfigMissing(false);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id ?? null;
        if (!currentUserId) {
          setLearners([]);
          setLoading(false);
          return;
        }

        const cached = readClientCache<Record<string, unknown>>('instructor:learners', SHELL_CACHE_MS);
        if (cached) {
          await applyLearnersPayload(cached);
          setLoading(false);
        }
        const { data } = await fetchJsonCached<Record<string, unknown>>(
          'instructor:learners',
          '/api/instructor/learners',
          { maxAgeMs: SHELL_CACHE_MS }
        );
        await applyLearnersPayload(data);
      } catch {
        setConfigMissing(true);
        setLearnersError('Could not load learners.');
        setLearnersEmptyReason(null);
        setLearners([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProfiles();
  }, []);

  useEffect(() => {
    const loadPrograms = async () => {
      setProgramsLoading(true);
      try {
        const res = await fetch('/api/instructor/programs', { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data.programs)) {
          setCoursePrograms(data.programs as CourseProgram[]);
        }
      } catch {
        // tables may not exist until migration is run
      } finally {
        setProgramsLoading(false);
      }
    };
    void loadPrograms();
  }, []);

  useEffect(() => {
    fetch('/api/email/status', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setEmailConfigured(Boolean(d?.configured)))
      .catch(() => setEmailConfigured(null));
  }, []);

  const refreshPendingInvites = async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id ?? null;
    if (!currentUserId) {
      setPendingInvites([]);
      return;
    }
    const { data, error } = await supabase
      .from('learner_invites')
      .select('id, email, course_id, status, created_at')
      .eq('created_by', currentUserId)
      .order('created_at', { ascending: false });
    if (error) {
      setPendingInvites([]);
      return;
    }
    setPendingInvites((data as { id: string; email: string; course_id: string | null; status: string; created_at: string }[]) ?? []);
  };

  useEffect(() => {
    void refreshPendingInvites();
  }, []);

  useEffect(() => {
    const fetchCourses = async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id ?? null;
      if (!currentUserId) {
        setPublishedCourses([]);
        return;
      }
      const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', currentUserId).maybeSingle();
      const role = (profile as { role?: string } | null)?.role;
      if (role === 'admin') {
        const { data } = await supabase.from('courses').select('id, title').eq('status', 'published').order('title');
        setPublishedCourses((data as { id: string; title: string }[]) || []);
        return;
      }
      const owned = await supabase.from('courses').select('id').eq('created_by', currentUserId);
      const ownedIds = (owned.data ?? []).map((c: { id: string }) => c.id);
      let collabIds: string[] = [];
      const collab = await supabase.from('course_collaborators').select('course_id').eq('user_id', currentUserId);
      if (collab.error) {
        // Table may not exist (404); treat as no collaborated courses
        collabIds = [];
      } else {
        collabIds = (collab.data ?? []).map((c: { course_id: string }) => c.course_id);
      }
      const combined = Array.from(new Set([...ownedIds, ...collabIds]));
      if (combined.length === 0) {
        setPublishedCourses([]);
        return;
      }
      const { data } = await supabase.from('courses').select('id, title').in('id', combined).eq('status', 'published').order('title');
      setPublishedCourses((data as { id: string; title: string }[]) || []);
    };
    fetchCourses();
  }, []);

  const showActionMessage = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 4000);
  };

  const parseEmailsFromText = (text: string): string[] => {
    return text
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  };

  const parseEmailsFromCSV = (file: File): Promise<string[]> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = (reader.result as string) || '';
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        const emails: string[] = [];
        const header = lines[0].toLowerCase();
        const emailCol = header.includes('email') ? header.split(/[\t,]/).findIndex((c) => c.trim() === 'email') : 1;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(/[\t,]/).map((c) => c.trim());
          const email = cols[emailCol];
          if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) emails.push(email.toLowerCase());
        }
        resolve(emails);
      };
      reader.readAsText(file);
    });
  };

  const openProgramModal = (program?: CourseProgram) => {
    if (program) {
      setEditingProgramId(program.id);
      setProgramTitle(program.title);
      setProgramDescription(program.description ?? '');
      setProgramCourseIds(program.courseIds);
    } else {
      setEditingProgramId(null);
      setProgramTitle('');
      setProgramDescription('');
      setProgramCourseIds([]);
    }
    setShowProgramModal(true);
  };

  const refreshPrograms = async () => {
    try {
      const res = await fetch('/api/instructor/programs', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.programs)) {
        setCoursePrograms(data.programs as CourseProgram[]);
      }
    } catch {
      // ignore
    }
  };

  const handleSaveProgram = async () => {
    if (!programTitle.trim()) {
      showActionMessage('Program title is required.');
      return;
    }
    if (programCourseIds.length === 0) {
      showActionMessage('Select at least one course for the program.');
      return;
    }
    setProgramSaving(true);
    try {
      const payload = {
        title: programTitle.trim(),
        description: programDescription.trim() || undefined,
        courseIds: programCourseIds,
      };
      const res = await fetch(
        editingProgramId
          ? `/api/instructor/programs/${editingProgramId}`
          : '/api/instructor/programs',
        {
          method: editingProgramId ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showActionMessage(data?.error ?? 'Could not save program. Run database/ADD_COURSE_PROGRAMS.sql in Supabase.');
        return;
      }
      await refreshPrograms();
      setShowProgramModal(false);
      showActionMessage(editingProgramId ? 'Program updated.' : 'Program created.');
    } catch {
      showActionMessage('Could not save program.');
    } finally {
      setProgramSaving(false);
    }
  };

  const handleDeleteProgram = async (programId: string) => {
    if (!window.confirm('Delete this program? Pending program invites will lose their link.')) return;
    try {
      const res = await fetch(`/api/instructor/programs/${programId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showActionMessage(data?.error ?? 'Could not delete program.');
        return;
      }
      if (inviteProgramId === programId) setInviteProgramId('');
      await refreshPrograms();
      showActionMessage('Program deleted.');
    } catch {
      showActionMessage('Could not delete program.');
    }
  };

  const handleInviteLearners = async () => {
    const emailsFromText = parseEmailsFromText(inviteEmails);
    let emailsFromCsv: string[] = [];
    if (bulkUploadFile) {
      try {
        emailsFromCsv = await parseEmailsFromCSV(bulkUploadFile);
      } catch {
        showActionMessage('Could not parse CSV.');
        return;
      }
    }
    const allEmails = Array.from(new Set([...emailsFromText, ...emailsFromCsv]));
    if (allEmails.length === 0) {
      showActionMessage('Enter at least one valid email or upload a CSV with an email column.');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      showActionMessage('Sign in to send invitations.');
      return;
    }
    const programId = inviteProgramId.trim() || null;
    const courseIds = programId ? [] : inviteCourseIds.filter(Boolean);
    const selectedProgram = coursePrograms.find((p) => p.id === programId);

    const rows: LearnerInviteInsert[] = [];
    for (const email of allEmails) {
      if (programId) {
        rows.push({
          email,
          course_id: null,
          program_id: programId,
          status: 'pending',
          created_by: session.user.id,
        });
        continue;
      }
      if (courseIds.length > 0) {
        for (const course_id of courseIds) {
          rows.push({
            email,
            course_id,
            program_id: null,
            status: 'pending',
            created_by: session.user.id,
          });
        }
        continue;
      }
      rows.push({
        email,
        course_id: null,
        program_id: null,
        status: 'pending',
        created_by: session.user.id,
      });
    }
    setInviteSending(true);
    const { error } = await (supabase as any).from('learner_invites').insert(rows);
    if (error) {
      setInviteSending(false);
      showActionMessage(
        error.message?.includes('program_id')
          ? 'Run database/ADD_COURSE_PROGRAMS.sql in Supabase, then try again.'
          : 'Invites could not be saved. Ensure the learner_invites table exists (see database/schema.sql).',
      );
      return;
    }
    void refreshPendingInvites();
    const selectedCourses = publishedCourses.filter((c) => courseIds.includes(c.id));
    try {
      const emailBody: Record<string, unknown> = {
        emails: allEmails,
        customMessage: inviteCustomMessage.trim() || undefined,
      };
      if (programId && selectedProgram) {
        emailBody.programId = programId;
        emailBody.programTitle = selectedProgram.title;
      } else if (courseIds.length > 1) {
        emailBody.courseIds = courseIds;
      } else if (courseIds.length === 1) {
        emailBody.courseId = courseIds[0];
        emailBody.courseTitle = selectedCourses[0]?.title;
      }
      const res = await fetch('/api/email/invite', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailBody),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        const failedNote = data.failed?.length ? ` (${data.failed.length} failed)` : '';
        showActionMessage(`Invites saved and emails sent to ${data.sent ?? allEmails.length} recipient(s)${failedNote}.`);
      } else if (res.status === 503) {
        showActionMessage(`Saved ${allEmails.length} invite(s). Add RESEND_API_KEY in .env.production on your server to send emails.`);
      } else {
        showActionMessage(`Invites saved. ${data?.error || 'Email could not be sent.'}`);
      }
    } catch {
      showActionMessage(`Saved ${allEmails.length} invitation(s). Email delivery failed — try again later.`);
    } finally {
      setInviteSending(false);
    }
    setShowInviteModal(false);
    setInviteEmails('');
    setInviteCustomMessage('');
    setBulkUploadFile(null);
    setInviteCourseIds([]);
    setInviteProgramId('');
  };

  const handleRemoveLearner = (learnerId: LearnerId) => {
    setLearners(learners.filter(l => l.id !== learnerId));
    showActionMessage('Learner removed from list.');
  };

  const handleSendReminder = async (learnerId: LearnerId, learnerEmail?: string, learnerName?: string) => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      showActionMessage('Configure Supabase to save reminders.');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const createdBy = session?.user?.id;
    if (!createdBy) {
      showActionMessage('Sign in to send reminders.');
      return;
    }
    const userId = typeof learnerId === 'string' ? learnerId : undefined;
    if (!userId) {
      showActionMessage('Reminder recorded. Configure email service to send reminders.');
      return;
    }
    try {
      const { error } = await (supabase as any).from('learner_reminders').insert({
        user_id: userId,
        created_by: createdBy,
        note: 'Reminder sent from Learners page'
      });
      if (error) throw error;
      const res = await fetch('/api/email/reminder', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          toEmail: learnerEmail || undefined,
          learnerName: learnerName || undefined,
          note: 'Reminder sent from Learners page',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        showActionMessage('Reminder saved and email sent.');
      } else {
        showActionMessage(data?.error || 'Reminder saved. Set RESEND_API_KEY to send reminder emails.');
      }
    } catch {
      showActionMessage('Failed to save reminder.');
    }
  };

  const exportLearnersCsv = (rows: typeof learners) => {
    downloadCsv(
      `learners-${new Date().toISOString().slice(0, 10)}`,
      ['Name', 'Email', 'Status', 'Enrolled courses', 'Completed', 'Progress %', 'Avg score', 'Last active', 'Joined'],
      rows.map((l) => [
        l.name,
        l.email,
        l.status,
        l.enrolledCourses,
        l.completedCourses,
        l.totalProgress,
        l.averageScore,
        l.lastActive,
        l.joinedDate,
      ]),
    );
  };

  const exportLearnerProgressCsv = (learner: (typeof learners)[0]) => {
    downloadCsv(
      `learner-${learner.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-progress`,
      ['Metric', 'Value'],
      [
        ['Name', learner.name],
        ['Email', learner.email],
        ['Status', learner.status],
        ['Enrolled courses', learner.enrolledCourses],
        ['Completed courses', learner.completedCourses],
        ['Overall progress %', learner.totalProgress],
        ['Average score %', learner.averageScore],
        ['Time spent', learner.totalTimeSpent],
        ['Last active', learner.lastActive],
        ['Joined', learner.joinedDate],
      ],
    );
  };

  const handleSendMessage = (learner: (typeof learners)[0]) => {
    const ok = openMailTo(
      learner.email,
      'Message from your Coursify instructor',
      `Hi ${learner.name},\n\n`,
    );
    if (!ok) showActionMessage('No email on file for this learner. Use Send Reminder instead.');
    setActiveDropdown(null);
  };

  const handleEnrollLearner = (learner: (typeof learners)[0]) => {
    const email = learner.email !== '(signed up)' ? learner.email : '';
    setInviteEmails(email);
    setShowInviteModal(true);
    setActiveDropdown(null);
    if (showLearnerDetail?.id === learner.id) setShowLearnerDetail(null);
  };

  const getStatusBadgeClass = (status: string) => learnerStatusBadge(status);

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'active': return <CheckCircle className="w-4 h-4" />;
      case 'at-risk': return <AlertCircle className="w-4 h-4" />;
      case 'inactive': return <X className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-full bg-canvas">
      {emailConfigured === false && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-8 py-2 text-sm text-amber-800 dark:text-amber-200">
          Email delivery is not configured. Invites are saved; add <code className="font-mono text-xs">RESEND_API_KEY</code> to <code className="font-mono text-xs">.env.production</code> on your server and restart the app to send invitation emails.
        </div>
      )}
      {configMissing && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-8 py-2 text-sm text-amber-800 dark:text-amber-200">
          Configure Supabase to load learners.
        </div>
      )}
      {actionMessage && (
        <div className="bg-green-50 dark:bg-green-900/30 border-b border-green-200 dark:border-green-800 px-8 py-2 text-sm text-green-800 dark:text-green-200 flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Header */}
      <div className="bg-surface border-b border-line px-8 py-6 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-content">Learners</h1>
            <p className="text-content-secondary mt-1">Enrolled learners in your courses — manage and track progress</p>
            {pendingInvites.length > 0 && (
              <p className="text-sm text-content-muted mt-1">{learners.length} enrolled · {pendingInvites.length} pending invite{pendingInvites.length !== 1 ? 's' : ''}</p>
            )}
          </div>
          <div className={pageHeaderActions}>
            <button
              type="button"
              onClick={() => exportLearnersCsv(getFilteredLearners())}
              className={headerSecondaryBtn}
            >
              <Download className="w-5 h-5" />
              Export Data
            </button>
            <button 
              onClick={() => setShowInviteModal(true)}
              className={headerPrimaryBtn}
            >
              <UserPlus className="w-5 h-5" />
              Invite Learners
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <ThemeStatCard icon={Users} title="Total Learners" value={stats.total} variant="info" />
          <ThemeStatCard icon={Activity} title="Active" value={stats.active} variant="success" />
          <ThemeStatCard icon={AlertCircle} title="At Risk" value={stats.atRisk} variant="warning" />
          <ThemeStatCard icon={Target} title="Avg. Completion" value={`${stats.avgCompletion}%`} variant="neutral" />
        </div>

        {/* Programs live on My Courses — invite modal still supports saved programs below */}
        {coursePrograms.length > 0 && (
          <p className="mb-4 text-xs text-content-muted">
            Manage programs on <button type="button" onClick={() => setCurrentView('courses')} className="text-violet-600 dark:text-violet-400 font-semibold hover:underline">My Courses</button> (Programs filter).
          </p>
        )}

        {/* Tabs and Filters */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <ThemeFilterTab active={selectedTab === 'all'} onClick={() => setSelectedTab('all')}>
              All ({stats.total})
            </ThemeFilterTab>
            <ThemeFilterTab active={selectedTab === 'active'} onClick={() => setSelectedTab('active')}>
              Active ({stats.active})
            </ThemeFilterTab>
            <ThemeFilterTab active={selectedTab === 'at-risk'} onClick={() => setSelectedTab('at-risk')}>
              At Risk ({stats.atRisk})
            </ThemeFilterTab>
            <ThemeFilterTab active={selectedTab === 'inactive'} onClick={() => setSelectedTab('inactive')}>
              Inactive ({stats.inactive})
            </ThemeFilterTab>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search learners..." 
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
              <option value="recent">Recently Active</option>
              <option value="name">Name (A-Z)</option>
              <option value="progress">Highest Progress</option>
              <option value="courses">Most Courses</option>
            </select>
          </div>
        </div>
      </div>

      {/* Learners List */}
      <div className="p-8">
        <div className="app-card rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-raised animate-pulse" />
              ))}
            </div>
          ) : filteredLearners.length === 0 ? (
            <div className="p-12">
              <div className="text-center text-content-muted mb-6">
                {learnersError ? (
                  <p className="text-amber-600 dark:text-amber-400 font-medium">{learnersError}</p>
                ) : configMissing ? (
                  'Configure Supabase to see learners.'
                ) : learnersEmptyReason === 'no_courses' ? (
                  'You have no courses yet. Create a course in My Courses, then share its link so learners can enroll — they will appear here.'
                ) : learnersEmptyReason === 'no_enrollments' ? (
                  'No enrolled learners yet. Share your course link or use Invite Learners — once they sign up and enroll, they will appear here.'
                ) : (
                  'No enrolled learners yet. This list shows people who have enrolled in your courses. Share your course link or use Invite Learners — once they sign up and enroll, they will appear here.'
                )}
              </div>
              {pendingInvites.length > 0 && (
                <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-600">
                  <h4 className="text-sm font-semibold text-content-secondary mb-3">Pending invites ({pendingInvites.length})</h4>
                  <p className="text-xs text-content-muted mb-4">These people have been invited. They will appear in Enrolled learners once they sign up and enroll.</p>
                  <ul className="space-y-2">
                    {pendingInvites.map((inv) => (
                      <li key={inv.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 bg-raised/50 rounded-lg text-sm">
                        <span className="text-content-secondary">{inv.email}</span>
                        <span className="text-xs text-content-muted capitalize">{inv.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : filteredLearners.map((learner) => (
            <div 
              key={learner.id}
              className="p-6 border-b border-line last:border-b-0 hover:bg-overlay/50 transition-all"
            >
              <div className="flex items-center justify-between">
                {/* Learner Info */}
                <div className="flex items-center flex-1">
                  <ThemeAvatar initials={learner.avatar} className="w-16 h-16 text-xl" />
                  
                  <div className="ml-4 flex-1">
                    <div className="flex items-center space-x-3 mb-1">
                      <h3 className="font-bold text-lg text-content">{learner.name}</h3>
                      <span className={`${getStatusBadgeClass(learner.status)} flex items-center space-x-1`}>
                        {getStatusIcon(learner.status)}
                        <span className="capitalize">{learner.status.replace('-', ' ')}</span>
                      </span>
                      {learner.streak > 0 && (
                        <div className="flex items-center bg-orange-100 px-2 py-1 rounded-full">
                          <Zap className="w-4 h-4 text-orange-600 mr-1" />
                          <span className="text-xs font-semibold text-orange-700">{learner.streak} day streak</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-content-secondary">
                      <span className="flex items-center">
                        <Mail className="w-4 h-4 mr-1" />
                        {learner.email}
                      </span>
                      <span>•</span>
                      <span>{learner.department}</span>
                      <span>•</span>
                      <span>{learner.role}</span>
                      <span>•</span>
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        Last active {learner.lastActive}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center space-x-8 mr-6">
                  <div className="text-center">
                    <p className="text-xl font-semibold text-content">{learner.enrolledCourses}</p>
                    <p className="text-xs text-content-secondary">Enrolled</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{learner.completedCourses}</p>
                    <p className="text-xs text-content-secondary">Completed</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{learner.totalProgress}%</p>
                      {learner.totalProgress >= 80 ? (
                        <ArrowUpRight className="w-5 h-5 text-green-600" />
                      ) : learner.totalProgress >= 50 ? (
                        <TrendingUp className="w-5 h-5 text-yellow-600" />
                      ) : (
                        <ArrowDownRight className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <p className="text-xs text-content-secondary">Avg. Progress</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{learner.averageScore}%</p>
                    <p className="text-xs text-content-secondary">Avg. Score</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => setShowLearnerDetail(learner)}
                    className={primaryBtn}
                  >
                    <Eye className="w-4 h-4" />
                    View Details
                  </button>
                  
                  <div className="relative">
                    <button 
                      onClick={() => setActiveDropdown(activeDropdown === learner.id ? null : learner.id)}
                      className={iconBtn}
                    >
                      <MoreVertical className="w-5 h-5 text-content-secondary" />
                    </button>

                    {activeDropdown === learner.id && (
                      <div className="absolute right-0 mt-2 w-56 bg-white bg-surface rounded-xl shadow-2xl border border-line py-2 z-30">
                        <button
                          type="button"
                          onClick={() => handleSendMessage(learner)}
                          className="w-full px-4 py-2 text-left hover:bg-overlay flex items-center text-sm text-content-secondary"
                        >
                          <Mail className="w-4 h-4 mr-3" />
                          Send Message
                        </button>
                        <button 
                          onClick={() => {
                            handleSendReminder(learner.id, learner.email !== '(signed up)' ? learner.email : undefined, learner.name);
                            setActiveDropdown(null);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-overlay flex items-center text-sm text-content-secondary"
                        >
                          <Bell className="w-4 h-4 mr-3" />
                          Send Reminder
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEnrollLearner(learner)}
                          className="w-full px-4 py-2 text-left hover:bg-overlay flex items-center text-sm text-content-secondary"
                        >
                          <BookOpen className="w-4 h-4 mr-3" />
                          Enroll in Course
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            exportLearnerProgressCsv(learner);
                            setActiveDropdown(null);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-overlay flex items-center text-sm text-content-secondary"
                        >
                          <FileDown className="w-4 h-4 mr-3" />
                          Export Progress
                        </button>
                        <hr className="my-2" />
                        <button 
                          onClick={() => {
                            handleRemoveLearner(learner.id);
                            setActiveDropdown(null);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-red-50 flex items-center text-sm text-red-600"
                        >
                          <UserMinus className="w-4 h-4 mr-3" />
                          Remove Learner
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-semibold text-content">Overall Progress</span>
                  <span className="text-content-secondary">{learner.completedCourses} of {learner.enrolledCourses} courses completed</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all ${
                      learner.totalProgress >= 80 ? 'bg-green-500' :
                      learner.totalProgress >= 50 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{width: `${learner.totalProgress}%`}}
                  ></div>
                </div>
              </div>

              {/* Badges and Certificates */}
              <div className="mt-4 flex items-center space-x-6 text-sm">
                <div className="flex items-center">
                  <Trophy className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mr-2" />
                  <span className="font-semibold text-content">{learner.badges}</span>
                  <span className="text-content-secondary ml-1">badges</span>
                </div>
                <div className="flex items-center">
                  <Award className="w-4 h-4 text-purple-600 dark:text-purple-400 mr-2" />
                  <span className="font-semibold text-content">{learner.certificates}</span>
                  <span className="text-content-secondary ml-1">certificates</span>
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" />
                  <span className="font-semibold text-content">{learner.totalTimeSpent}</span>
                  <span className="text-content-secondary ml-1">learning time</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 text-content-secondary mr-2" />
                  <span className="text-content-secondary">Joined {learner.joinedDate}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Learners Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="app-card rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-line">
            <div className="p-6 border-b border-line flex items-center justify-between sticky top-0 bg-white bg-surface z-10">
              <div>
                <h3 className="text-2xl font-bold text-content">Invite learners</h3>
                <p className="text-sm text-content-muted mt-1">Invites are saved and an email is sent when Resend is configured.</p>
              </div>
              <button 
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteEmails('');
                  setInviteCustomMessage('');
                  setBulkUploadFile(null);
                }}
                className="p-2 rounded-lg hover:bg-overlay text-content-muted transition-all"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <label htmlFor="invite-message" className="block text-sm font-semibold mb-2 text-content-secondary">Personal message (optional)</label>
                <textarea
                  id="invite-message"
                  value={inviteCustomMessage}
                  onChange={(e) => setInviteCustomMessage(e.target.value)}
                  placeholder="Add a note for your learners — shown above the invitation card in the email."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-raised text-content rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent h-24 resize-none placeholder:text-gray-400 mb-6"
                />
                <label htmlFor="invite-emails" className="block text-sm font-semibold mb-2 text-content-secondary">Email addresses</label>
                <textarea 
                  id="invite-emails"
                  value={inviteEmails}
                  onChange={(e) => setInviteEmails(e.target.value)}
                  placeholder={'john@company.com\njane@company.com'}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-raised text-content rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent h-32 resize-none placeholder:text-gray-400"
                />
                <p className="text-xs text-content-muted mt-2">Separate emails with commas or line breaks.</p>
              </div>

              <div className="flex items-center my-6">
                <div className="flex-1 border-t border-gray-200 dark:border-gray-600" />
                <span className="px-4 text-xs uppercase tracking-wide text-content-muted font-medium">or</span>
                <div className="flex-1 border-t border-gray-200 dark:border-gray-600" />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2 text-content-secondary">Bulk upload (CSV)</label>
                <label
                  htmlFor="csv-upload"
                  className="block border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer bg-surface/50"
                >
                  <Upload className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                  <p className="font-medium mb-1 text-content">Drop a CSV here or click to browse</p>
                  <p className="text-sm text-content-muted">Include an <code className="text-xs">email</code> column</p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setBulkUploadFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="csv-upload"
                  />
                </label>
                {bulkUploadFile && (
                  <div className="mt-3 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center min-w-0">
                      <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2 shrink-0" />
                      <span className="text-sm font-medium text-content truncate">{bulkUploadFile.name}</span>
                    </div>
                    <button type="button" onClick={() => setBulkUploadFile(null)} className="text-red-600 dark:text-red-400 hover:text-red-700 p-1">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mb-6">
                <label htmlFor="invite-program" className="block text-sm font-semibold mb-2 text-content-secondary">Saved program (recommended)</label>
                <select
                  id="invite-program"
                  value={inviteProgramId}
                  onChange={(e) => {
                    setInviteProgramId(e.target.value);
                    if (e.target.value) setInviteCourseIds([]);
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-raised text-content rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent mb-2"
                >
                  <option value="">— Pick courses manually below —</option>
                  {coursePrograms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.courseIds.length} courses)
                    </option>
                  ))}
                </select>
                {inviteProgramId && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    One invite email · auto-enroll in all {coursePrograms.find((p) => p.id === inviteProgramId)?.courseIds.length ?? 0} courses on sign-up.
                  </p>
                )}
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-content-secondary">Or pick courses ad hoc</label>
                  {inviteCourseIds.length > 0 && !inviteProgramId && (
                    <button
                      type="button"
                      onClick={() => setInviteCourseIds([])}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      Clear selection
                    </button>
                  )}
                </div>
                <p className="text-xs text-content-muted mb-3">
                  {inviteProgramId
                    ? 'Clear the program above to select individual courses instead.'
                    : 'Select one or more published courses. Learners receive one combined email.'}
                </p>
                {publishedCourses.length === 0 ? (
                  <p className="text-sm text-content-muted italic">No published courses yet.</p>
                ) : (
                  <div className={`max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-xl divide-y divide-gray-200 dark:divide-gray-600 ${inviteProgramId ? 'opacity-50 pointer-events-none' : ''}`}>
                    {publishedCourses.map((c) => {
                      const checked = inviteCourseIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-overlay/50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={Boolean(inviteProgramId)}
                            onChange={() => {
                              setInviteProgramId('');
                              setInviteCourseIds((prev) =>
                                checked ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                              );
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-brand"
                          />
                          <span className="text-sm text-content">{c.title}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {inviteCourseIds.length > 1 && !inviteProgramId && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium">
                    {inviteCourseIds.length} courses selected — one combined invite email per learner.
                  </p>
                )}
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-blue-900 dark:text-blue-100">
                    <p className="font-semibold mb-1">What happens next</p>
                    <ul className="space-y-1 text-blue-800 dark:text-blue-200/90 list-disc list-inside">
                      <li>Invitation is recorded in pending invites</li>
                      <li>Learner receives an email with a sign-up link</li>
                      <li>They appear here once enrolled</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmails('');
                    setBulkUploadFile(null);
                  }}
                  disabled={inviteSending}
                  className={`flex-1 ${headerSecondaryBtn} disabled:opacity-50`}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleInviteLearners}
                  disabled={inviteSending}
                  className={`flex-1 ${headerPrimaryBtn} disabled:opacity-60`}
                >
                  {inviteSending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Send invitations
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Learner Detail Modal */}
      {showLearnerDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="app-card rounded-lg shadow-2xl max-w-4xl w-full my-8 border border-line">
            <div className="p-6 border-b border-line flex items-center justify-between">
              <div className="flex items-center">
                <ThemeAvatar initials={showLearnerDetail.avatar} className="w-16 h-16 text-2xl" />
                <div className="ml-4">
                  <h3 className="text-2xl font-bold text-content">{showLearnerDetail.name}</h3>
                  <p className="text-content-secondary">{showLearnerDetail.email}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowLearnerDetail(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <ThemeStatCard icon={TrendingUp} title="Total Progress" value={`${showLearnerDetail.totalProgress}%`} variant="info" />
                <ThemeStatCard icon={Star} title="Avg. Score" value={`${showLearnerDetail.averageScore}%`} variant="success" />
                <ThemeStatCard icon={Award} title="Certificates" value={showLearnerDetail.certificates} variant="neutral" />
                <ThemeStatCard icon={Clock} title="Time Spent" value={showLearnerDetail.totalTimeSpent} variant="warning" />
              </div>

              {/* Profile Info */}
              <div className="mb-6 bg-raised rounded-xl p-4 border border-line">
                <h4 className="font-bold mb-3 text-content">Profile Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-content-secondary mb-1">Department</p>
                    <p className="font-semibold text-content">{showLearnerDetail.department}</p>
                  </div>
                  <div>
                    <p className="text-content-secondary mb-1">Role</p>
                    <p className="font-semibold text-content">{showLearnerDetail.role}</p>
                  </div>
                  <div>
                    <p className="text-content-secondary mb-1">Manager</p>
                    <p className="font-semibold text-content">{showLearnerDetail.manager}</p>
                  </div>
                  <div>
                    <p className="text-content-secondary mb-1">Joined Date</p>
                    <p className="font-semibold text-content">{showLearnerDetail.joinedDate}</p>
                  </div>
                </div>
              </div>

              {/* Enrolled Courses */}
              <div className="mb-6">
                <h4 className="font-bold mb-3 text-content">Enrolled Courses ({showLearnerDetail.enrolledCourses})</h4>
                <div className="space-y-3">
                  {showLearnerDetail.courses.map((course: any) => (
                    <div key={course.id} className="bg-gray-50 bg-raised/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <h5 className="font-semibold text-content">{course.name}</h5>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-content-secondary">
                            <span className={`c-badge ${course.status === 'completed' ? 'c-badge-ok' : 'c-badge-info'}`}>
                              {course.status === 'completed' ? 'Completed' : 'In Progress'}
                            </span>
                            {course.status === 'completed' ? (
                              <span>Completed: {course.completedDate}</span>
                            ) : (
                              <span>Last accessed: {course.lastAccessed}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{course.score}%</p>
                          <p className="text-xs text-content-secondary">Score</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2 mr-3">
                          <div 
                            className={`h-2 rounded-full ${
                              course.progress === 100 ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{width: `${course.progress}%`}}
                          ></div>
                        </div>
                        <span className="text-sm font-semibold text-content">{course.progress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="mb-6">
                <h4 className="font-bold mb-3 text-content">Recent Activity</h4>
                <div className="space-y-3">
                  {showLearnerDetail.activityLog.map((activity: any, idx: number) => (
                    <div key={idx} className="flex items-center bg-gray-50 bg-raised/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                      {activity.type === 'completed' && <CheckCircle className="w-5 h-5 text-green-600 mr-3" />}
                      {activity.type === 'started' && <Play className="w-5 h-5 text-blue-600 mr-3" />}
                      {activity.type === 'quiz-passed' && <Trophy className="w-5 h-5 text-yellow-600 mr-3" />}
                      {activity.type === 'missed-deadline' && <AlertCircle className="w-5 h-5 text-red-600 mr-3" />}
                      {activity.type === 'inactive' && <Clock className="w-5 h-5 text-gray-600 mr-3" />}
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-content">
                          {activity.type === 'completed' && `Completed ${activity.course}`}
                          {activity.type === 'started' && `Started ${activity.course}`}
                          {activity.type === 'quiz-passed' && `Passed quiz in ${activity.course} with ${activity.score}%`}
                          {activity.type === 'missed-deadline' && `Missed deadline for ${activity.course}`}
                          {activity.type === 'inactive' && 'No activity'}
                        </p>
                        <p className="text-xs text-content-secondary">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => handleSendMessage(showLearnerDetail)}
                  className={`flex-1 ${headerPrimaryBtn}`}
                >
                  <Mail className="w-5 h-5" />
                  Send Message
                </button>
                <button
                  type="button"
                  onClick={() => handleEnrollLearner(showLearnerDetail)}
                  className={`flex-1 ${headerSecondaryBtn}`}
                >
                  <BookOpen className="w-5 h-5" />
                  Enroll in Course
                </button>
                <button
                  type="button"
                  onClick={() => exportLearnerProgressCsv(showLearnerDetail)}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-content-secondary rounded-xl hover:bg-overlay font-semibold flex items-center justify-center transition-all"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Export Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / edit course program */}
      {showProgramModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="app-card rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-line">
            <div className="p-6 border-b border-line flex items-center justify-between">
              <h3 className="text-xl font-bold text-content">
                {editingProgramId ? 'Edit program' : 'New course program'}
              </h3>
              <button type="button" onClick={() => setShowProgramModal(false)} className="p-2 rounded-lg hover:bg-overlay text-content-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-content-secondary uppercase tracking-wider mb-1.5">Program name</label>
                <input
                  type="text"
                  value={programTitle}
                  onChange={(e) => setProgramTitle(e.target.value)}
                  placeholder="e.g. Google Project Management Certificate"
                  className="app-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary uppercase tracking-wider mb-1.5">Description (optional)</label>
                <textarea
                  value={programDescription}
                  onChange={(e) => setProgramDescription(e.target.value)}
                  className="app-input h-20 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary uppercase tracking-wider mb-1.5">Courses in this program</label>
                <div className="max-h-52 overflow-y-auto border border-line rounded-lg divide-y divide-line">
                  {publishedCourses.map((c) => {
                    const checked = programCourseIds.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-overlay/50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setProgramCourseIds((prev) =>
                              checked ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                            );
                          }}
                          className="rounded border-line text-brand focus:ring-brand/40"
                        />
                        <span className="text-sm text-content">{c.title}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProgramModal(false)}
                  className="flex-1 c-btn c-btn-ghost py-3"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveProgram()}
                  disabled={programSaving}
                  className="flex-1 c-btn c-btn-primary py-3 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {programSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save program
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Learners;
