'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Award, ExternalLink, Info, Loader2, X } from 'lucide-react';

export interface AssessmentContentPayload {
  title: string;
  description?: string;
  assessmentProId: string;
  accessMode: 'lms_embed' | 'proctored_portal';
  passingScore: number;
}

type TabId = 'pick' | 'create' | 'builder' | 'paste';

type CatalogItem = {
  id: string;
  title: string;
  description?: string;
  accessMode: 'lms_embed' | 'proctored_portal';
  passingScore: number;
  durationMinutes?: number;
  questionCount?: number;
};

interface AddAssessmentPanelProps {
  active: boolean;
  onClose: () => void;
  onAdd: (assessment: AssessmentContentPayload) => void;
}

const AP_ORIGIN =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_ASSESSMENT_PRO_ORIGIN
    ? process.env.NEXT_PUBLIC_ASSESSMENT_PRO_ORIGIN.replace(/\/+$/, '')
    : 'https://assessments.bsoc.space';

export function AddAssessmentPanel({ active, onClose, onAdd }: AddAssessmentPanelProps) {
  const [tab, setTab] = useState<TabId>('pick');
  const [accessMode, setAccessMode] = useState<'lms_embed' | 'proctored_portal'>('lms_embed');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [proId, setProId] = useState('');
  const [passingScore, setPassingScore] = useState(70);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [builderUrl, setBuilderUrl] = useState<string | null>(null);
  const [builderAssessmentId, setBuilderAssessmentId] = useState<string | null>(null);
  const [builderEmbedBlocked, setBuilderEmbedBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const reset = useCallback(() => {
    setTab('pick');
    setAccessMode('lms_embed');
    setTitle('');
    setDescription('');
    setProId('');
    setPassingScore(70);
    setDurationMinutes(15);
    setCatalog([]);
    setSelectedCatalogId('');
    setBuilderUrl(null);
    setBuilderAssessmentId(null);
    setBuilderEmbedBlocked(false);
    setError(null);
    setLoading(false);
    setCatalogLoading(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const finishAdd = useCallback(
    (payload: AssessmentContentPayload) => {
      onAdd(payload);
      handleClose();
    },
    [onAdd, handleClose]
  );

  const loadCatalog = useCallback(async (mode: string) => {
    setCatalogLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/instructor/assessments/catalog?accessMode=${encodeURIComponent(mode)}`,
        { credentials: 'include' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? 'Failed to load assessments');
        setCatalog([]);
        return;
      }
      const items = (data as { assessments?: CatalogItem[] }).assessments ?? [];
      setCatalog(items);
      setSelectedCatalogId(items[0]?.id ?? '');
      if (items[0]) {
        setTitle(items[0].title);
        setPassingScore(items[0].passingScore ?? 70);
        setDescription(items[0].description ?? '');
      }
    } catch {
      setError('Failed to load assessments. Check you are signed in and Assessment Pro is configured.');
      setCatalog([]);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    if (tab === 'pick') void loadCatalog(accessMode);
  }, [active, tab, accessMode, loadCatalog]);

  useEffect(() => {
    if (!active) return;

    function onMessage(event: MessageEvent) {
      if (event.origin !== AP_ORIGIN) return;
      const data = event.data as { type?: string; assessmentId?: string; title?: string; passingScore?: number };
      if (data?.type !== 'assessment-pro:builder-saved' || !data.assessmentId) return;
      finishAdd({
        title: data.title?.trim() || title.trim() || 'Assessment',
        description: description.trim() || undefined,
        assessmentProId: data.assessmentId,
        accessMode,
        passingScore:
          typeof data.passingScore === 'number'
            ? Math.min(100, Math.max(0, Math.round(data.passingScore)))
            : passingScore,
      });
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [active, accessMode, title, description, passingScore, finishAdd]);

  const startBuilderSession = useCallback(async (): Promise<{ embedBuilderUrl: string; assessmentId?: string } | null> => {
    setLoading(true);
    setError(null);
    try {
      const parentOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const res = await fetch('/api/instructor/assessments/builder-session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessMode,
          title: title.trim() || undefined,
          parentOrigin,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? 'Failed to start designer session');
        return null;
      }
      const session = data as { embedBuilderUrl?: string; assessmentId?: string; embedBlocked?: boolean };
      if (!session.embedBuilderUrl) {
        setError('Designer URL missing from Assessment Pro');
        return null;
      }
      setBuilderUrl(session.embedBuilderUrl);
      setBuilderAssessmentId(session.assessmentId ?? null);
      setBuilderEmbedBlocked(Boolean(session.embedBlocked));
      return { embedBuilderUrl: session.embedBuilderUrl, assessmentId: session.assessmentId };
    } catch {
      setError('Failed to connect to Assessment Pro. Try Create simple or Pick existing.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [accessMode, title]);

  useEffect(() => {
    if (!active || tab !== 'builder' || builderUrl || loading) return;
    void startBuilderSession();
  }, [active, tab, builderUrl, loading, startBuilderSession]);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/instructor/assessments/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          accessMode,
          passingScore,
          durationMinutes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? 'Failed to create assessment');
        return;
      }
      const assessment = (data as { assessment?: CatalogItem }).assessment;
      if (!assessment?.id) {
        setError('Create succeeded but no assessment id returned');
        return;
      }
      finishAdd({
        title: assessment.title || title.trim(),
        description: assessment.description || description.trim() || undefined,
        assessmentProId: assessment.id,
        accessMode: assessment.accessMode ?? accessMode,
        passingScore: assessment.passingScore ?? passingScore,
      });
    } catch {
      setError('Failed to create assessment');
    } finally {
      setLoading(false);
    }
  };

  const handlePick = () => {
    const item = catalog.find((c) => c.id === selectedCatalogId);
    if (!item) {
      setError('Select an assessment');
      return;
    }
    finishAdd({
      title: title.trim() || item.title,
      description: description.trim() || item.description,
      assessmentProId: item.id,
      accessMode: item.accessMode,
      passingScore: item.passingScore ?? passingScore,
    });
  };

  const handlePaste = () => {
    const id = proId.trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      setError('Enter a valid assessment UUID');
      return;
    }
    finishAdd({
      title: title.trim() || 'Assessment',
      description: description.trim() || undefined,
      assessmentProId: id,
      accessMode,
      passingScore: Math.min(100, Math.max(0, Number(passingScore) || 70)),
    });
  };

  const handleBuilderDone = () => {
    const id = builderAssessmentId;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      setError('Publish in Assessment Pro first, or use Create simple / Pick existing.');
      return;
    }
    finishAdd({
      title: title.trim() || 'Assessment',
      description: description.trim() || undefined,
      assessmentProId: id,
      accessMode,
      passingScore,
    });
  };

  if (!active) return null;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'pick', label: 'Pick existing' },
    { id: 'create', label: 'Create simple' },
    { id: 'builder', label: 'Design in AP' },
    { id: 'paste', label: 'Paste UUID' },
  ];

  return (
    <div className="mb-6 rounded-2xl border-2 border-indigo-300 dark:border-indigo-800 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-indigo-50 dark:bg-indigo-950/40">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-indigo-600" />
          Add Assessment to this lesson
        </h3>
        <button type="button" onClick={handleClose} className="p-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50" aria-label="Close">
          <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      <div className="px-6 pt-5">
        <div className="flex flex-wrap gap-2 mb-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setError(null);
                if (t.id !== 'builder') {
                  setBuilderUrl(null);
                  setBuilderAssessmentId(null);
                  setBuilderEmbedBlocked(false);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-4 max-w-md">
          <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Assessment type</label>
          <select
            value={accessMode}
            onChange={(e) => {
              setAccessMode(e.target.value as 'lms_embed' | 'proctored_portal');
              setSelectedCatalogId('');
            }}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
          >
            <option value="lms_embed">Module quiz (embedded in lesson)</option>
            <option value="proctored_portal">Final exam (opens in Assessment Pro)</option>
          </select>
        </div>
      </div>

      <div className="px-6 pb-5">
        {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

        {tab === 'pick' && (
          <div className="space-y-4 max-w-xl">
            {catalogLoading ? (
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading from Assessment Pro…
              </p>
            ) : catalog.length === 0 ? (
              <p className="text-sm text-gray-500">No assessments for this type yet. Use <strong>Create simple</strong> to add one.</p>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Choose assessment</label>
                  <select
                    value={selectedCatalogId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedCatalogId(id);
                      const item = catalog.find((c) => c.id === id);
                      if (item) {
                        setTitle(item.title);
                        setPassingScore(item.passingScore ?? 70);
                        setDescription(item.description ?? '');
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                  >
                    {catalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.questionCount ?? 0} questions)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Lesson display title (optional)</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'create' && (
          <div className="space-y-4 max-w-xl">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 text-sm text-indigo-900 dark:text-indigo-200 flex gap-2">
              <Info className="w-5 h-5 flex-shrink-0" />
              <p>Creates a starter quiz in Assessment Pro with one sample question. You can edit it later in Assessment Pro.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Module 1 Quiz"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Passing score (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={passingScore}
                  onChange={(e) => setPassingScore(Number(e.target.value) || 70)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Duration (min)</label>
                <input
                  type="number"
                  min={1}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value) || 15)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {tab === 'builder' && (
          <div className="space-y-4 flex flex-col min-h-[50vh]">
            {loading && !builderUrl && (
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Connecting to Assessment Pro…
              </p>
            )}
            {builderEmbedBlocked && (
              <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-900 dark:text-amber-200">
                Assessment Pro is not allowing iframe embeds from this site yet (<code className="text-xs">X-Frame-Options: SAMEORIGIN</code>).
                Open the designer in a new tab below. The AP team must set <code className="text-xs">COURSIFY_FRAME_ANCESTORS</code> for{' '}
                <code className="text-xs">{typeof window !== 'undefined' ? window.location.origin : 'your Coursify domain'}</code> to enable inline embedding.
              </div>
            )}
            {!builderEmbedBlocked && builderUrl && (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Design questions below. Click <strong>Publish</strong> in Assessment Pro to link this assessment to your lesson.
                </p>
                <iframe
                  src={builderUrl}
                  title="Assessment Pro builder"
                  className="w-full flex-1 min-h-[45vh] border border-gray-200 dark:border-gray-600 rounded-xl"
                  allow="clipboard-read; clipboard-write"
                />
              </>
            )}
            {builderEmbedBlocked && builderUrl && (
              <a
                href={builderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 w-fit"
              >
                <ExternalLink className="w-4 h-4" />
                Open Assessment Pro designer
              </a>
            )}
            {builderUrl && (
              <p className="text-xs text-gray-500 break-all">
                Designer link:{' '}
                <a href={builderUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                  {builderUrl}
                </a>
              </p>
            )}
          </div>
        )}

        {tab === 'paste' && (
          <div className="space-y-4 max-w-xl">
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Assessment Pro ID (UUID)</label>
              <input
                type="text"
                value={proId}
                onChange={(e) => setProId(e.target.value)}
                placeholder="Paste assessment UUID"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm bg-white dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Passing score (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value) || 70)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleClose}
          className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl font-semibold text-gray-900 dark:text-white hover:bg-white dark:hover:bg-gray-800"
        >
          Cancel
        </button>
        {tab === 'pick' && (
          <button
            type="button"
            onClick={handlePick}
            disabled={!selectedCatalogId || catalogLoading}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            Add to lesson
          </button>
        )}
        {tab === 'create' && (
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={loading || !title.trim()}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create & add to lesson'}
          </button>
        )}
        {tab === 'builder' && (
          <button
            type="button"
            onClick={handleBuilderDone}
            disabled={!builderAssessmentId}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            Add draft to lesson
          </button>
        )}
        {tab === 'paste' && (
          <button
            type="button"
            onClick={handlePaste}
            disabled={!/^[0-9a-f-]{36}$/i.test(proId.trim())}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            Add to lesson
          </button>
        )}
      </div>
    </div>
  );
}
