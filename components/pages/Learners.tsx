'use client'

import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Clock, Search, Mail, Download, Upload, MoreVertical,
  CheckCircle, AlertCircle, TrendingUp, Target, Calendar, BookOpen, Star, Send, UserPlus, UserMinus,
  Activity, Trophy, FileDown, ArrowUpRight, ArrowDownRight, Zap, X, Play, FileText, Bell, Award, Eye
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchJsonCached, readClientCache } from '@/lib/client-fetch-cache';
import type { Database } from '@/lib/database.types';

type LearnerInviteInsert = Database['public']['Tables']['learner_invites']['Insert'];

interface LearnersProps {
  setCurrentView: (view: string) => void;
}

type LearnerId = number | string;

const Learners: React.FC<LearnersProps> = ({ setCurrentView }) => {
  const [selectedTab, setSelectedTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showLearnerDetail, setShowLearnerDetail] = useState<any>(null);
  const [activeDropdown, setActiveDropdown] = useState<LearnerId | null>(null);
  const [inviteEmails, setInviteEmails] = useState('');
  const [bulkUploadFile, setBulkUploadFile] = useState<File | null>(null);
  const [inviteCourseId, setInviteCourseId] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [learners, setLearners] = useState<any[]>([]);
  const [publishedCourses, setPublishedCourses] = useState<{ id: string; title: string }[]>([]);
  const [configMissing, setConfigMissing] = useState(false);
  const [learnersError, setLearnersError] = useState<string | null>(null);
  const [learnersEmptyReason, setLearnersEmptyReason] = useState<'no_courses' | 'no_enrollments' | null>(null);
  const [pendingInvites, setPendingInvites] = useState<{ id: string; email: string; course_id: string | null; status: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

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
    const mapLearnerRow = (p: {
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
    }) => {
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
    };

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
        setLearners(apiLearners.map((p) => mapLearnerRow(p as Parameters<typeof mapLearnerRow>[0])));
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

        const cached = readClientCache<Record<string, unknown>>('instructor:learners', 60_000);
        if (cached) {
          await applyLearnersPayload(cached);
          setLoading(false);
        }
        const { data } = await fetchJsonCached<Record<string, unknown>>('instructor:learners', '/api/instructor/learners');
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
    const fetchPendingInvites = async () => {
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
    fetchPendingInvites();
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
    const courseId = inviteCourseId.trim() || null;
    const rows: LearnerInviteInsert[] = allEmails.map((email) => ({
      email,
      course_id: courseId,
      status: 'pending',
      created_by: session.user.id,
    }));
    const { error } = await (supabase as any).from('learner_invites').insert(rows);
    if (error) {
      showActionMessage('Invites could not be saved. Ensure the learner_invites table exists (see database/schema.sql).');
      return;
    }
    const courseTitle = publishedCourses.find((c) => c.id === courseId)?.title;
    try {
      const res = await fetch('/api/email/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: allEmails, courseId: courseId || undefined, courseTitle }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        showActionMessage(`Invites saved and emails sent to ${data.sent ?? allEmails.length} recipient(s).`);
      } else {
        showActionMessage(`Invites saved. ${data?.error || 'Set RESEND_API_KEY to send invite emails.'}`);
      }
    } catch {
      showActionMessage(`Saved ${allEmails.length} invitation(s). Set RESEND_API_KEY to send emails.`);
    }
    setShowInviteModal(false);
    setInviteEmails('');
    setBulkUploadFile(null);
    setInviteCourseId('');
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

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'at-risk': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      case 'inactive': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'active': return <CheckCircle className="w-4 h-4" />;
      case 'at-risk': return <AlertCircle className="w-4 h-4" />;
      case 'inactive': return <X className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-full dark:bg-gray-900">
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
      <div className="bg-white dark:bg-gray-900 dark:border-gray-800 border-b border-gray-200 dark:border-gray-800 px-8 py-6 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Learners</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Enrolled learners in your courses — manage and track progress</p>
            {pendingInvites.length > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{learners.length} enrolled · {pendingInvites.length} pending invite{pendingInvites.length !== 1 ? 's' : ''}</p>
            )}
          </div>
          <div className="flex space-x-3">
            <button className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200 font-semibold flex items-center transition-all">
              <Download className="w-5 h-5 mr-2" />
              Export Data
            </button>
            <button 
              onClick={() => setShowInviteModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold flex items-center shadow-lg transition-all"
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Invite Learners
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold">Total Learners</p>
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{stats.total}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-green-600 font-semibold">Active</p>
              <Activity className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-700">{stats.active}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-4 rounded-xl border border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-orange-600 dark:text-orange-400 font-semibold">At Risk</p>
              <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <p className="text-3xl font-bold text-orange-700 dark:text-white">{stats.atRisk}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-purple-600 dark:text-purple-400 font-semibold">Avg. Completion</p>
              <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-3xl font-bold text-purple-700 dark:text-white">{stats.avgCompletion}%</p>
          </div>
        </div>

        {/* Tabs and Filters */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setSelectedTab('all')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                selectedTab === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              All ({stats.total})
            </button>
            <button 
              onClick={() => setSelectedTab('active')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                selectedTab === 'active' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Active ({stats.active})
            </button>
            <button 
              onClick={() => setSelectedTab('at-risk')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                selectedTab === 'at-risk' ? 'bg-orange-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              At Risk ({stats.atRisk})
            </button>
            <button 
              onClick={() => setSelectedTab('inactive')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                selectedTab === 'inactive' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Inactive ({stats.inactive})
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search learners..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg w-64 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-semibold"
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
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse" />
              ))}
            </div>
          ) : filteredLearners.length === 0 ? (
            <div className="p-12">
              <div className="text-center text-gray-500 dark:text-gray-400 mb-6">
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
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Pending invites ({pendingInvites.length})</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">These people have been invited. They will appear in Enrolled learners once they sign up and enroll.</p>
                  <ul className="space-y-2">
                    {pendingInvites.map((inv) => (
                      <li key={inv.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                        <span className="text-gray-700 dark:text-gray-200">{inv.email}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{inv.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : filteredLearners.map((learner) => (
            <div 
              key={learner.id}
              className="p-6 border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all"
            >
              <div className="flex items-center justify-between">
                {/* Learner Info */}
                <div className="flex items-center flex-1">
                  <div className={`w-16 h-16 bg-gradient-to-br ${learner.avatarColor} rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                    {learner.avatar}
                  </div>
                  
                  <div className="ml-4 flex-1">
                    <div className="flex items-center space-x-3 mb-1">
                      <h3 className="font-bold text-lg dark:text-white">{learner.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1 ${getStatusColor(learner.status)}`}>
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
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300">
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
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{learner.enrolledCourses}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300">Enrolled</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{learner.completedCourses}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300">Completed</p>
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
                    <p className="text-xs text-gray-600 dark:text-gray-300">Avg. Progress</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{learner.averageScore}%</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300">Avg. Score</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => setShowLearnerDetail(learner)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center transition-all"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </button>
                  
                  <div className="relative">
                    <button 
                      onClick={() => setActiveDropdown(activeDropdown === learner.id ? null : learner.id)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                    >
                      <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </button>

                    {activeDropdown === learner.id && (
                      <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 z-30">
                        <button className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center text-sm dark:text-gray-200">
                          <Mail className="w-4 h-4 mr-3" />
                          Send Message
                        </button>
                        <button 
                          onClick={() => {
                            handleSendReminder(learner.id, learner.email !== '(signed up)' ? learner.email : undefined, learner.name);
                            setActiveDropdown(null);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center text-sm dark:text-gray-200"
                        >
                          <Bell className="w-4 h-4 mr-3" />
                          Send Reminder
                        </button>
                        <button className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center text-sm dark:text-gray-200">
                          <BookOpen className="w-4 h-4 mr-3" />
                          Enroll in Course
                        </button>
                        <button className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center text-sm dark:text-gray-200">
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
                  <span className="font-semibold dark:text-white">Overall Progress</span>
                  <span className="text-gray-600 dark:text-gray-300">{learner.completedCourses} of {learner.enrolledCourses} courses completed</span>
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
                  <span className="font-semibold dark:text-white">{learner.badges}</span>
                  <span className="text-gray-600 dark:text-gray-300 ml-1">badges</span>
                </div>
                <div className="flex items-center">
                  <Award className="w-4 h-4 text-purple-600 dark:text-purple-400 mr-2" />
                  <span className="font-semibold dark:text-white">{learner.certificates}</span>
                  <span className="text-gray-600 dark:text-gray-300 ml-1">certificates</span>
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" />
                  <span className="font-semibold dark:text-white">{learner.totalTimeSpent}</span>
                  <span className="text-gray-600 dark:text-gray-300 ml-1">learning time</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400 mr-2" />
                  <span className="text-gray-600 dark:text-gray-300">Joined {learner.joinedDate}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Learners Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-2xl font-bold dark:text-white">Invite Learners</h3>
              <button 
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteEmails('');
                  setBulkUploadFile(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Email Input */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2 dark:text-gray-200">Email Addresses</label>
                <textarea 
                  value={inviteEmails}
                  onChange={(e) => setInviteEmails(e.target.value)}
                  placeholder="Enter email addresses separated by commas or new lines&#10;e.g., john@company.com, jane@company.com"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32 resize-none"
                />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Separate multiple emails with commas or line breaks</p>
              </div>

              {/* Divider */}
              <div className="flex items-center my-6">
                <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
                <span className="px-4 text-sm text-gray-600 dark:text-gray-400 font-semibold">OR</span>
                <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
              </div>

              {/* Bulk Upload */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2 dark:text-gray-200">Bulk Upload CSV</label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-blue-500 transition-all cursor-pointer dark:bg-gray-800/50">
                  <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                  <p className="font-semibold mb-1 dark:text-white">Drop CSV file here or click to browse</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Upload a CSV with columns: name, email, department</p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setBulkUploadFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm cursor-pointer inline-block"
                  >
                    Choose File
                  </label>
                </div>
                {bulkUploadFile && (
                  <div className="mt-3 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center">
                      <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
                      <span className="text-sm font-semibold dark:text-white">{bulkUploadFile.name}</span>
                    </div>
                    <button onClick={() => setBulkUploadFile(null)} className="text-red-600 hover:text-red-700">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Course Assignment */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">Auto-Enroll in Courses (Optional)</label>
                <select
                  value={inviteCourseId}
                  onChange={(e) => setInviteCourseId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select courses to auto-enroll</option>
                  {publishedCourses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">What happens next?</p>
                    <ul className="space-y-1 text-blue-800">
                      <li>• Learners will receive an email invitation</li>
                      <li>• They can create an account and access assigned courses</li>
                      <li>• You&apos;ll be able to track their progress immediately</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3">
                <button 
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmails('');
                    setBulkUploadFile(null);
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleInviteLearners}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold transition-all shadow-lg flex items-center justify-center"
                >
                  <Send className="w-5 h-5 mr-2" />
                  Send Invitations
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Learner Detail Modal */}
      {showLearnerDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full my-8 border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-16 h-16 bg-gradient-to-br ${showLearnerDetail.avatarColor} rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg`}>
                  {showLearnerDetail.avatar}
                </div>
                <div className="ml-4">
                  <h3 className="text-2xl font-bold dark:text-white">{showLearnerDetail.name}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{showLearnerDetail.email}</p>
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
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold mb-1">Total Progress</p>
                  <p className="text-3xl font-bold text-blue-700 dark:text-white">{showLearnerDetail.totalProgress}%</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-600 dark:text-green-400 font-semibold mb-1">Avg. Score</p>
                  <p className="text-3xl font-bold text-green-700 dark:text-white">{showLearnerDetail.averageScore}%</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800">
                  <p className="text-sm text-purple-600 dark:text-purple-400 font-semibold mb-1">Certificates</p>
                  <p className="text-3xl font-bold text-purple-700 dark:text-white">{showLearnerDetail.certificates}</p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-4 rounded-xl border border-orange-200 dark:border-orange-800">
                  <p className="text-sm text-orange-600 dark:text-orange-400 font-semibold mb-1">Time Spent</p>
                  <p className="text-2xl font-bold text-orange-700 dark:text-white">{showLearnerDetail.totalTimeSpent}</p>
                </div>
              </div>

              {/* Profile Info */}
              <div className="mb-6 bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-bold mb-3 dark:text-white">Profile Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 mb-1">Department</p>
                    <p className="font-semibold dark:text-white">{showLearnerDetail.department}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 mb-1">Role</p>
                    <p className="font-semibold dark:text-white">{showLearnerDetail.role}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 mb-1">Manager</p>
                    <p className="font-semibold dark:text-white">{showLearnerDetail.manager}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 mb-1">Joined Date</p>
                    <p className="font-semibold dark:text-white">{showLearnerDetail.joinedDate}</p>
                  </div>
                </div>
              </div>

              {/* Enrolled Courses */}
              <div className="mb-6">
                <h4 className="font-bold mb-3 dark:text-white">Enrolled Courses ({showLearnerDetail.enrolledCourses})</h4>
                <div className="space-y-3">
                  {showLearnerDetail.courses.map((course: any) => (
                    <div key={course.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <h5 className="font-semibold dark:text-white">{course.name}</h5>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              course.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                            }`}>
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
                          <p className="text-xs text-gray-600 dark:text-gray-400">Score</p>
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
                        <span className="text-sm font-semibold dark:text-white">{course.progress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="mb-6">
                <h4 className="font-bold mb-3 dark:text-white">Recent Activity</h4>
                <div className="space-y-3">
                  {showLearnerDetail.activityLog.map((activity: any, idx: number) => (
                    <div key={idx} className="flex items-center bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                      {activity.type === 'completed' && <CheckCircle className="w-5 h-5 text-green-600 mr-3" />}
                      {activity.type === 'started' && <Play className="w-5 h-5 text-blue-600 mr-3" />}
                      {activity.type === 'quiz-passed' && <Trophy className="w-5 h-5 text-yellow-600 mr-3" />}
                      {activity.type === 'missed-deadline' && <AlertCircle className="w-5 h-5 text-red-600 mr-3" />}
                      {activity.type === 'inactive' && <Clock className="w-5 h-5 text-gray-600 mr-3" />}
                      <div className="flex-1">
                        <p className="text-sm font-semibold dark:text-white">
                          {activity.type === 'completed' && `Completed ${activity.course}`}
                          {activity.type === 'started' && `Started ${activity.course}`}
                          {activity.type === 'quiz-passed' && `Passed quiz in ${activity.course} with ${activity.score}%`}
                          {activity.type === 'missed-deadline' && `Missed deadline for ${activity.course}`}
                          {activity.type === 'inactive' && 'No activity'}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3">
                <button className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold flex items-center justify-center transition-all">
                  <Mail className="w-5 h-5 mr-2" />
                  Send Message
                </button>
                <button className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold flex items-center justify-center transition-all">
                  <BookOpen className="w-5 h-5 mr-2" />
                  Enroll in Course
                </button>
                <button className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold flex items-center justify-center transition-all">
                  <Download className="w-5 h-5 mr-2" />
                  Export Data
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
