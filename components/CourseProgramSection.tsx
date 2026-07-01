'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Copy,
  Edit,
  Layers,
  Loader2,
  Mail,
  Plus,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { CourseProgramSummary } from '@/lib/course-programs';

type PublishedCourse = { id: string; title: string; status: string; learners?: number };

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

type CourseProgramSectionProps = {
  publishedCourses: PublishedCourse[];
  userId?: string;
  searchQuery: string;
  programsOnly: boolean;
  showCards?: boolean;
  createRequested?: boolean;
  onCreateHandled?: () => void;
  onProgramsChange?: (count: number) => void;
};

export default function CourseProgramSection({
  publishedCourses,
  userId,
  searchQuery,
  programsOnly,
  showCards = true,
  createRequested,
  onCreateHandled,
  onProgramsChange,
}: CourseProgramSectionProps) {
  const [programs, setPrograms] = useState<CourseProgramSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [programSaving, setProgramSaving] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [programTitle, setProgramTitle] = useState('');
  const [programDescription, setProgramDescription] = useState('');
  const [programCourseIds, setProgramCourseIds] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const [inviteProgram, setInviteProgram] = useState<CourseProgramSummary | null>(null);
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteMagicLink, setInviteMagicLink] = useState<string | null>(null);
  const [inviteMagicLinkLoading, setInviteMagicLinkLoading] = useState(false);
  const [inviteMagicLinkError, setInviteMagicLinkError] = useState<string | null>(null);
  const [inviteCopyFeedback, setInviteCopyFeedback] = useState(false);

  const [collabProgram, setCollabProgram] = useState<CourseProgramSummary | null>(null);
  const [collabCourseId, setCollabCourseId] = useState<string>('');
  const [collabEmail, setCollabEmail] = useState('');
  const [collabLoading, setCollabLoading] = useState(false);
  const [collabError, setCollabError] = useState<string | null>(null);
  const [collabSuccess, setCollabSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteProgram) {
      setInviteMagicLink(null);
      setInviteMagicLinkError(null);
      setInviteMagicLinkLoading(false);
      setInviteCopyFeedback(false);
      return;
    }
    setInviteMagicLinkLoading(true);
    setInviteMagicLinkError(null);
    fetch(`/api/instructor/programs/${encodeURIComponent(inviteProgram.id)}/magic-link`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data: { magicLink?: string; error?: string }) => {
        if (data.magicLink) setInviteMagicLink(data.magicLink);
        else setInviteMagicLinkError(data.error || 'Could not create link');
      })
      .catch(() => setInviteMagicLinkError('Could not create link'))
      .finally(() => setInviteMagicLinkLoading(false));
  }, [inviteProgram]);

  const showActionMessage = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 5000);
  }, []);

  const refreshPrograms = useCallback(async () => {
    try {
      const res = await fetch('/api/instructor/programs', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.programs)) {
        setPrograms(data.programs as CourseProgramSummary[]);
        onProgramsChange?.(data.programs.length);
      }
    } catch {
      // ignore
    }
  }, [onProgramsChange]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/instructor/programs', { credentials: 'include' })
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data.programs)) {
          setPrograms(data.programs as CourseProgramSummary[]);
          onProgramsChange?.(data.programs.length);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onProgramsChange]);

  const filteredPrograms = useMemo(() => {
    let list = programs;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q) ||
          p.courses.some((c) => c.title.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [programs, searchQuery]);

  const openProgramModal = (program?: CourseProgramSummary) => {
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

  useEffect(() => {
    if (!createRequested) return;
    openProgramModal();
    onCreateHandled?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createRequested, onCreateHandled]);

  const handleSaveProgram = async () => {
    if (!programTitle.trim()) {
      showActionMessage('Program title is required.');
      return;
    }
    if (programCourseIds.length === 0) {
      showActionMessage('Select at least one published course.');
      return;
    }
    setProgramSaving(true);
    try {
      const body = {
        title: programTitle.trim(),
        description: programDescription.trim() || undefined,
        courseIds: programCourseIds,
      };
      const res = await fetch(
        editingProgramId ? `/api/instructor/programs/${editingProgramId}` : '/api/instructor/programs',
        {
          method: editingProgramId ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showActionMessage(data?.error ?? 'Could not save program.');
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showActionMessage(data?.error ?? 'Could not delete program.');
        return;
      }
      await refreshPrograms();
      showActionMessage('Program deleted.');
    } catch {
      showActionMessage('Could not delete program.');
    }
  };

  const handleProgramInvite = async () => {
    if (!inviteProgram) return;
    const emails = parseInviteEmails(inviteEmails);
    if (emails.length === 0) {
      setInviteError('Enter at least one valid email.');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      setInviteError('Sign in to send invitations.');
      return;
    }
    setInviteLoading(true);
    setInviteError(null);
    setInviteSuccess(null);
    const rows = emails.map((email) => ({
      email,
      course_id: null,
      program_id: inviteProgram.id,
      status: 'pending' as const,
      created_by: session.user.id,
    }));
    const { error } = await supabase.from('learner_invites').insert(rows);
    if (error) {
      setInviteLoading(false);
      setInviteError(
        error.message?.includes('program_id')
          ? 'Run database/ADD_COURSE_PROGRAMS.sql in Supabase.'
          : 'Could not save invites.',
      );
      return;
    }
    try {
      const res = await fetch('/api/email/invite', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails,
          programId: inviteProgram.id,
          programTitle: inviteProgram.title,
          customMessage: inviteMessage.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setInviteSuccess(`Invites sent to ${data.sent ?? emails.length} recipient(s).`);
        setInviteEmails('');
        setInviteMessage('');
      } else if (res.status === 503) {
        setInviteSuccess(`Saved ${emails.length} invite(s). Add RESEND_API_KEY to send emails.`);
        setInviteEmails('');
      } else {
        setInviteSuccess(`Saved ${emails.length} invite(s). ${data?.error || 'Email delivery failed.'}`);
        setInviteEmails('');
      }
    } catch {
      setInviteSuccess(`Saved ${emails.length} invitation(s). Email delivery failed.`);
      setInviteEmails('');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleProgramCollaborator = async () => {
    if (!collabProgram || !collabCourseId || !collabEmail.trim()) return;
    setCollabLoading(true);
    setCollabError(null);
    setCollabSuccess(null);
    try {
      const res = await fetch('/api/courses/invite-collaborator', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: collabCourseId, email: collabEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCollabError(data?.error ?? 'Failed to invite');
        return;
      }
      setCollabEmail('');
      setCollabSuccess(
        data.emailSent
          ? 'Co-instructor added and notified by email.'
          : 'Co-instructor added.',
      );
    } catch {
      setCollabError('Request failed');
    } finally {
      setCollabLoading(false);
    }
  };

  const programLearnerTotal = (program: CourseProgramSummary) =>
    program.courseIds.reduce((sum, id) => {
      const c = publishedCourses.find((pc) => pc.id === id);
      return sum + (c?.learners ?? 0);
    }, 0);

  if (loading && programs.length === 0 && showCards) {
    return programsOnly ? (
      <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">Loading programs…</div>
    ) : null;
  }

  if (programsOnly && filteredPrograms.length === 0) {
    return (
      <div className="col-span-full text-center py-16 app-card border-2 border-dashed border-line rounded-2xl">
        <Layers className="w-16 h-16 text-brand mx-auto mb-4" />
        <h3 className="text-2xl font-bold mb-2 text-content">No programs yet</h3>
        <p className="text-content-secondary mb-6 max-w-md mx-auto">
          Group published courses into a certificate track or learning path, then invite learners once.
        </p>
        <button
          type="button"
          onClick={() => openProgramModal()}
          className="px-6 py-3 btn-brand rounded-xl font-semibold inline-flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create program
        </button>
      </div>
    );
  }

  const cards = filteredPrograms.map((program) => (
    <div
      key={program.id}
      className="app-card rounded-2xl overflow-hidden hover:shadow-xl transition-all group border border-line"
    >
      <div className="bg-brand-subtle border-b border-line h-48 flex items-center justify-center relative program c-course-thumb">
        <Layers className="w-16 h-16 thumb-icon" />
        <span className="c-badge c-badge-program c-thumb-badge">
          Program
        </span>
        <span className="absolute bottom-4 right-4 px-2 py-1 rounded-lg text-xs font-semibold bg-overlay text-content-secondary border border-line">
          {program.courseIds.length} courses
        </span>
      </div>

      <div className="p-6">
        <div className="mb-4">
          <h3 className="font-bold text-lg mb-1 line-clamp-1 text-content">{program.title}</h3>
          {program.description ? (
            <p className="text-sm text-content-secondary line-clamp-2">{program.description}</p>
          ) : (
            <p className="text-sm text-content-muted italic">Multi-course learning track</p>
          )}
        </div>

        <ul className="mb-4 space-y-1">
          {program.courses.slice(0, 3).map((c, i) => (
            <li key={c.id} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 flex items-center justify-center font-bold shrink-0">
                {i + 1}
              </span>
              <span className="truncate">{c.title}</span>
            </li>
          ))}
          {program.courses.length > 3 && (
            <li className="text-xs text-violet-600 dark:text-violet-400 pl-7">+{program.courses.length - 3} more</li>
          )}
        </ul>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <BookOpen className="w-4 h-4 mr-2 shrink-0 text-violet-500" />
            <span>{program.courseIds.length} courses</span>
          </div>
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Users className="w-4 h-4 mr-2 shrink-0 text-violet-500" />
            <span>{programLearnerTotal(program)} learners</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setInviteProgram(program);
              setInviteEmails('');
              setInviteMessage('');
              setInviteError(null);
              setInviteSuccess(null);
            }}
            className="flex-1 min-w-[120px] px-3 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-semibold text-sm flex items-center justify-center gap-1.5"
          >
            <Mail className="w-4 h-4" />
            Invite
          </button>
          <button
            type="button"
            onClick={() => {
              setCollabProgram(program);
              setCollabCourseId(program.courseIds[0] ?? '');
              setCollabEmail('');
              setCollabError(null);
              setCollabSuccess(null);
            }}
            className="px-3 py-2 border border-violet-300 dark:border-violet-600 text-violet-700 dark:text-violet-300 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 text-sm flex items-center gap-1.5"
            title="Add co-instructors to courses in this program"
          >
            <UserPlus className="w-4 h-4" />
            Co-instructors
          </button>
          <button
            type="button"
            onClick={() => openProgramModal(program)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            title="Edit program"
          >
            <Edit className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
          <button
            type="button"
            onClick={() => void handleDeleteProgram(program.id)}
            className="px-3 py-2 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            title="Delete program"
          >
            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      </div>
    </div>
  ));

  return (
    <>
      {showCards && !programsOnly && filteredPrograms.length > 0 && (
        <div className="col-span-full mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <h2 className="text-lg font-bold text-content">Programs & tracks</h2>
            <span className="text-sm text-content-muted">({filteredPrograms.length})</span>
          </div>
          <button
            type="button"
            onClick={() => openProgramModal()}
            className="text-sm font-semibold text-brand hover:underline inline-flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            New program
          </button>
        </div>
      )}

      {showCards && cards}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-xl bg-gray-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}

      {showProgramModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="app-card rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-line">
            <div className="p-6 border-b border-line flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-content">
                {editingProgramId ? 'Edit program' : 'New course program'}
              </h3>
              <button type="button" onClick={() => setShowProgramModal(false)} className="p-2 rounded-lg hover:bg-overlay text-content-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-xs font-medium text-content-secondary uppercase tracking-wider mb-1.5">Program name</label>
                <input
                  type="text"
                  value={programTitle}
                  onChange={(e) => setProgramTitle(e.target.value)}
                  placeholder="e.g. Google PM Certificate"
                  className="app-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary uppercase tracking-wider mb-1.5">Description (optional)</label>
                <textarea
                  value={programDescription}
                  onChange={(e) => setProgramDescription(e.target.value)}
                  rows={2}
                  className="app-input resize-none h-20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary uppercase tracking-wider mb-1.5">Published courses in this program</label>
                <div className="max-h-48 overflow-y-auto border border-line rounded-lg divide-y divide-line">
                  {publishedCourses.length === 0 ? (
                    <p className="p-4 text-sm text-content-muted">Publish at least one course first.</p>
                  ) : (
                    publishedCourses.map((c) => {
                      const checked = programCourseIds.includes(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-overlay/50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setProgramCourseIds((prev) =>
                                checked ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                              )
                            }
                            className="rounded border-line text-brand focus:ring-brand/40"
                          />
                          <span className="text-sm text-content">{c.title}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-line flex gap-3 justify-end shrink-0">
              <button type="button" onClick={() => setShowProgramModal(false)} className="c-btn c-btn-ghost px-5 py-2.5">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveProgram()}
                disabled={programSaving}
                className="c-btn c-btn-primary px-5 py-2.5 disabled:opacity-60 flex items-center gap-2"
              >
                {programSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save program
              </button>
            </div>
          </div>
        </div>
      )}

      {inviteProgram && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400 mb-1">Program invite</p>
                <h3 className="text-xl font-bold dark:text-white">{inviteProgram.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  One email · enroll in all {inviteProgram.courseIds.length} courses on sign-up
                </p>
              </div>
              <button type="button" onClick={() => setInviteProgram(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-5">
              <p className="text-sm font-semibold mb-2 dark:text-gray-200">Share link (magic link)</p>
              {inviteMagicLinkError && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">
                  {inviteMagicLinkError}. Showing program link instead.
                </p>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={
                    inviteMagicLinkLoading
                      ? 'Loading…'
                      : inviteMagicLink
                        ?? (typeof window !== 'undefined' && inviteProgram
                          ? `${window.location.origin}/program/${inviteProgram.id}`
                          : '')
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white text-sm"
                />
                <button
                  type="button"
                  disabled={inviteMagicLinkLoading}
                  onClick={() => {
                    const url = inviteMagicLink
                      ?? (typeof window !== 'undefined' && inviteProgram
                        ? `${window.location.origin}/program/${inviteProgram.id}`
                        : '');
                    if (!url) return;
                    void navigator.clipboard.writeText(url).then(() => {
                      setInviteCopyFeedback(true);
                      window.setTimeout(() => setInviteCopyFeedback(false), 2000);
                    }).catch(() => {
                      setInviteCopyFeedback(true);
                      window.setTimeout(() => setInviteCopyFeedback(false), 2000);
                    });
                  }}
                  className="px-3 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-semibold flex items-center gap-1.5 shrink-0 disabled:opacity-70 text-sm"
                >
                  <Copy className="w-4 h-4" />
                  {inviteCopyFeedback ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Anyone with this link can sign in and enroll in all {inviteProgram.courseIds.length} courses.
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mb-4">
              <p className="text-sm font-semibold mb-2 dark:text-gray-200 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Invite learners by email
              </p>
            </div>
            <label className="block text-sm font-semibold mb-2 dark:text-gray-200">Email addresses</label>
            <textarea
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
              placeholder={'learner@company.com\nanother@company.com'}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl resize-none mb-4"
            />
            <label className="block text-sm font-semibold mb-2 dark:text-gray-200">Message (optional)</label>
            <textarea
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl resize-none mb-4"
            />
            {inviteError && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{inviteError}</p>}
            {inviteSuccess && <p className="text-sm text-green-600 dark:text-green-400 mb-2">{inviteSuccess}</p>}
            <button
              type="button"
              onClick={() => void handleProgramInvite()}
              disabled={inviteLoading}
              className="w-full py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Send invitations
            </button>
          </div>
        </div>
      )}

      {collabProgram && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold dark:text-white">Co-instructors</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{collabProgram.title}</p>
              </div>
              <button type="button" onClick={() => setCollabProgram(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <label className="block text-sm font-semibold mb-2 dark:text-gray-200">Course</label>
            <select
              value={collabCourseId}
              onChange={(e) => setCollabCourseId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl mb-4"
            >
              {collabProgram.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Invite a co-instructor to help edit a course in this program. They must already have a Coursify account.</p>
            <div className="flex gap-2 mb-4">
              <input
                type="email"
                placeholder="Email address"
                value={collabEmail}
                onChange={(e) => { setCollabEmail(e.target.value); setCollabError(null); }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
              <button
                type="button"
                onClick={() => void handleProgramCollaborator()}
                disabled={collabLoading || !collabEmail.trim()}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1"
              >
                {collabLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Invite
              </button>
            </div>
            {collabSuccess && <p className="text-sm text-green-600 dark:text-green-400">{collabSuccess}</p>}
            {collabError && <p className="text-sm text-red-600 dark:text-red-400">{collabError}</p>}
          </div>
        </div>
      )}
    </>
  );
}
