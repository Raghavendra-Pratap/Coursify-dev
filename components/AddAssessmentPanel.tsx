'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Award, ChevronDown, ExternalLink, Loader2, X } from 'lucide-react';
import { inputValueFromEvent } from '@/lib/dom-event';

export interface AssessmentContentPayload {
  title: string;
  description?: string;
  assessmentProId: string;
  accessMode: 'lms_embed' | 'proctored_portal';
  passingScore: number;
}

function fieldValue(e: { target: EventTarget }): string {
  return inputValueFromEvent(e);
}

type TabId = 'builder' | 'pick' | 'paste';

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
  onUpdate?: (assessment: AssessmentContentPayload) => void;
  mode?: 'add' | 'edit';
  initialAssessment?: AssessmentContentPayload;
  /** Bust iframe cache when reopening the add flow. */
  sessionKey?: string | number;
  /** Render inside the lesson preview embed (full height, no outer margin). */
  embedded?: boolean;
}

const AP_ORIGIN =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_ASSESSMENT_PRO_ORIGIN
    ? process.env.NEXT_PUBLIC_ASSESSMENT_PRO_ORIGIN.replace(/\/+$/, '')
    : 'https://assessments.bsoc.space';

export function AddAssessmentPanel({
  active,
  onClose,
  onAdd,
  onUpdate,
  mode = 'add',
  initialAssessment,
  sessionKey,
  embedded = false,
}: AddAssessmentPanelProps) {
  const isEdit = mode === 'edit';
  const [tab, setTab] = useState<TabId>('builder');
  const [accessMode, setAccessMode] = useState<'lms_embed' | 'proctored_portal'>('lms_embed');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [proId, setProId] = useState('');
  const [passingScore, setPassingScore] = useState(70);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [builderUrl, setBuilderUrl] = useState<string | null>(null);
  const [builderAssessmentId, setBuilderAssessmentId] = useState<string | null>(null);
  const [builderEmbedBlocked, setBuilderEmbedBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const resetBuilderSession = useCallback(() => {
    setBuilderUrl(null);
    setBuilderAssessmentId(null);
    setBuilderEmbedBlocked(false);
  }, []);

  const reset = useCallback(() => {
    setTab('builder');
    setAccessMode('lms_embed');
    setTitle('');
    setDescription('');
    setProId('');
    setPassingScore(70);
    setCatalog([]);
    setSelectedCatalogId('');
    resetBuilderSession();
    setError(null);
    setLoading(false);
    setCatalogLoading(false);
    setMoreOpen(false);
  }, [resetBuilderSession]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const finishAdd = useCallback(
    (payload: AssessmentContentPayload) => {
      if (isEdit && onUpdate) {
        onUpdate(payload);
      } else {
        onAdd(payload);
      }
      handleClose();
    },
    [isEdit, onAdd, onUpdate, handleClose]
  );

  useEffect(() => {
    if (!active || !isEdit || !initialAssessment) return;
    setTab('builder');
    setAccessMode(initialAssessment.accessMode);
    setTitle(initialAssessment.title);
    setDescription(initialAssessment.description ?? '');
    setProId(initialAssessment.assessmentProId);
    setPassingScore(initialAssessment.passingScore);
    resetBuilderSession();
    setError(null);
  }, [active, isEdit, initialAssessment, resetBuilderSession]);

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
    if (!active || tab !== 'pick') return;
    void loadCatalog(accessMode);
  }, [active, tab, accessMode, loadCatalog]);

  useEffect(() => {
    if (!active) return;

    function onMessage(event: MessageEvent) {
      if (event.origin !== AP_ORIGIN) return;
      const data = event.data as { type?: string; assessmentId?: string; title?: string; passingScore?: number };
      if (data?.type !== 'assessment-pro:builder-saved' || !data.assessmentId) return;
      // AP saved/published — keep the builder open; user confirms with "Add to lesson" / "Save changes".
      setBuilderAssessmentId(data.assessmentId);
      if (data.title?.trim()) setTitle(data.title.trim());
      if (typeof data.passingScore === 'number') {
        setPassingScore(Math.min(100, Math.max(0, Math.round(data.passingScore))));
      }
      setError(null);
    }

    window.addEventListener('message', onMessage as EventListener);
    return () => window.removeEventListener('message', onMessage as EventListener);
  }, [active]);

  const startBuilderSession = useCallback(async (): Promise<{ embedBuilderUrl: string; assessmentId?: string } | null> => {
    setLoading(true);
    setError(null);
    try {
      const parentOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
      let assessmentIdForBuilder = isEdit ? initialAssessment?.assessmentProId?.trim() : undefined;

      // AP resumes the last in-progress draft when no assessmentId is sent — create a new one first.
      if (!isEdit) {
        const createTitle = title.trim() || 'Untitled Assessment';
        const createRes = await fetch('/api/instructor/assessments/create', {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: createTitle,
            description: description.trim() || undefined,
            accessMode,
            passingScore,
          }),
        });
        const createData = await createRes.json().catch(() => ({}));
        if (!createRes.ok) {
          setError((createData as { error?: string }).error ?? 'Failed to create a new assessment');
          return null;
        }
        const newId = (createData as { assessment?: { id?: string; title?: string } }).assessment?.id;
        if (!newId) {
          setError('Assessment Pro did not return a new assessment id');
          return null;
        }
        assessmentIdForBuilder = newId;
        const createdTitle = (createData as { assessment?: { title?: string } }).assessment?.title;
        if (createdTitle?.trim() && !title.trim()) setTitle(createdTitle.trim());
      }

      const res = await fetch('/api/instructor/assessments/builder-session', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessMode,
          title: title.trim() || undefined,
          parentOrigin,
          assessmentId: assessmentIdForBuilder || undefined,
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
      setBuilderAssessmentId(session.assessmentId ?? assessmentIdForBuilder ?? null);
      setBuilderEmbedBlocked(Boolean(session.embedBlocked));
      return { embedBuilderUrl: session.embedBuilderUrl, assessmentId: session.assessmentId };
    } catch {
      setError('Failed to connect to Assessment Pro.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [accessMode, title, description, passingScore, isEdit, initialAssessment?.assessmentProId]);

  useEffect(() => {
    if (!active) {
      resetBuilderSession();
      return;
    }
    if (tab !== 'builder' || builderUrl || loading) return;
    void startBuilderSession();
  }, [active, tab, builderUrl, loading, startBuilderSession, resetBuilderSession]);

  useEffect(() => {
    if (active || isEdit) return;
    reset();
  }, [active, isEdit, reset]);

  const switchTab = (next: TabId) => {
    setTab(next);
    setError(null);
    setMoreOpen(false);
    if (next !== 'builder') resetBuilderSession();
  };

  const handleAccessModeChange = (mode: 'lms_embed' | 'proctored_portal') => {
    setAccessMode(mode);
    setSelectedCatalogId('');
    if (tab === 'builder') resetBuilderSession();
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
    const id = builderAssessmentId ?? (isEdit ? initialAssessment?.assessmentProId : null);
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      setError('Publish in Assessment Pro first, or pick an existing assessment.');
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

  const builderHeightClass = 'h-[75vh] min-h-[560px] max-h-[920px]';
  const embeddedBuilderHeightClass = 'h-[75vh] min-h-[560px]';

  const saveLabel = isEdit ? 'Save changes' : 'Add to lesson';

  return (
    <div
      className={`w-full overflow-hidden flex flex-col ${
        embedded
          ? `bg-gray-900 dark:bg-gray-950 ${tab === 'builder' ? embeddedBuilderHeightClass : 'min-h-[24rem]'}`
          : `mb-6 rounded-2xl border-2 border-indigo-300 dark:border-indigo-800 bg-white dark:bg-gray-800 shadow-lg ${tab === 'builder' ? builderHeightClass : ''}`
      }`}
    >
      {/* Compact header */}
      <div className={`px-4 py-3 border-b flex items-center gap-3 flex-shrink-0 ${
        embedded
          ? 'border-gray-700 bg-gray-800/90'
          : 'border-gray-200 dark:border-gray-700 bg-indigo-50 dark:bg-indigo-950/40'
      }`}>
        <Award className="w-5 h-5 text-indigo-400 flex-shrink-0" />
        <h3 className={`text-lg font-bold flex-1 min-w-0 truncate ${embedded ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
          {isEdit
            ? tab === 'builder'
              ? 'Edit assessment'
              : tab === 'pick'
                ? 'Replace assessment'
                : 'Update assessment link'
            : tab === 'builder'
              ? 'Design assessment'
              : tab === 'pick'
                ? 'Pick existing'
                : 'Paste UUID'}
        </h3>

        <select
          value={accessMode}
          onChange={(e) => handleAccessModeChange(fieldValue(e) as 'lms_embed' | 'proctored_portal')}
          className="text-sm px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white max-w-[11rem] sm:max-w-none"
          title="Assessment type"
        >
          <option value="lms_embed">Module quiz</option>
          <option value="proctored_portal">Final exam</option>
        </select>
        {!embedded && (
          <p className="hidden lg:block text-xs text-gray-500 dark:text-gray-400 max-w-xs">
            {accessMode === 'lms_embed'
              ? 'In-lesson: code & quiz questions in the lesson. Google Sheets open in a new tab if needed. No proctoring.'
              : 'Opens in a new tab with proctoring and full exam setup.'}
          </p>
        )}

        {tab === 'builder' && (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(fieldValue(e))}
            placeholder="Lesson title (optional)"
            className="hidden sm:block text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white w-44 lg:w-56"
          />
        )}

        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className="flex items-center gap-1 text-sm px-2 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
            aria-expanded={moreOpen}
          >
            More <ChevronDown className={`w-4 h-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
          </button>
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} aria-hidden />
              <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1 text-sm">
                <button
                  type="button"
                  onClick={() => switchTab('builder')}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${tab === 'builder' ? 'text-indigo-600 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                >
                  Design in AP
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('pick')}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${tab === 'pick' ? 'text-indigo-600 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                >
                  Pick existing
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('paste')}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${tab === 'paste' ? 'text-indigo-600 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                >
                  Paste UUID
                </button>
              </div>
            </>
          )}
        </div>

        <button type="button" onClick={handleClose} className="p-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 flex-shrink-0" aria-label="Close">
          <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {error && (
        <p className="px-4 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900 flex-shrink-0">
          {error}
        </p>
      )}

      {/* Main content — builder fills panel height */}
      <div className={`flex-1 min-h-0 w-full flex flex-col ${tab === 'builder' ? 'overflow-hidden' : ''}`}>
        {tab === 'builder' && (
          <div className="flex flex-col flex-1 min-h-0 w-full">
            {builderEmbedBlocked && builderUrl && (
              <div className="mx-3 mt-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex-shrink-0">
                Iframe blocked by Assessment Pro —{' '}
                <a href={builderUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium">
                  open designer in new tab
                </a>
                . AP must allow <code className="text-[10px]">{typeof window !== 'undefined' ? window.location.origin : 'this domain'}</code> in frame ancestors.
              </div>
            )}

            <div className={`flex-1 min-h-0 w-full p-3 ${embedded ? 'min-h-[calc(75vh-8rem)]' : 'min-h-[calc(75vh-10rem)]'}`}>
              {loading && !builderUrl && (
                <div className="w-full h-full min-h-[480px] flex items-center justify-center bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> Loading Assessment Pro designer…
                  </p>
                </div>
              )}

              {!builderEmbedBlocked && builderUrl && (
                <iframe
                  key={`${sessionKey ?? 'session'}-${builderUrl}`}
                  src={builderUrl}
                  title="Assessment Pro builder"
                  className="block w-full h-full min-h-[480px] rounded-xl border border-gray-200 dark:border-gray-600 bg-white"
                  allow="clipboard-read; clipboard-write"
                />
              )}

              {builderEmbedBlocked && builderUrl && (
                <div className="w-full h-full flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 gap-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md text-center px-4">
                    Design your questions in Assessment Pro, then return here. Publishing will link the assessment automatically.
                  </p>
                  <a
                    href={builderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Assessment Pro designer
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'pick' && (
          <div className="p-6 space-y-4 max-w-xl">
            <button
              type="button"
              onClick={() => switchTab('builder')}
              className="text-sm text-indigo-600 hover:underline"
            >
              ← Back to designer
            </button>
            {catalogLoading ? (
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading from Assessment Pro…
              </p>
            ) : catalog.length === 0 ? (
              <p className="text-sm text-gray-500">No assessments for this type yet. Use the designer to create one.</p>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Choose assessment</label>
                  <select
                    value={selectedCatalogId}
                    onChange={(e) => {
                      const id = fieldValue(e);
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
                    onChange={(e) => setTitle(fieldValue(e))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'paste' && (
          <div className="p-6 space-y-4 max-w-xl">
            <button
              type="button"
              onClick={() => switchTab('builder')}
              className="text-sm text-indigo-600 hover:underline"
            >
              ← Back to designer
            </button>
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(fieldValue(e))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Assessment Pro ID (UUID)</label>
              <input
                type="text"
                value={proId}
                onChange={(e) => setProId(fieldValue(e))}
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
                onChange={(e) => setPassingScore(Number(fieldValue(e)) || 70)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 flex flex-wrap gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={handleClose}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl font-semibold text-sm text-gray-900 dark:text-white hover:bg-white dark:hover:bg-gray-800"
        >
          Cancel
        </button>
        {tab === 'builder' && (
          <button
            type="button"
            onClick={handleBuilderDone}
            disabled={!builderAssessmentId && !(isEdit && initialAssessment?.assessmentProId)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {saveLabel}
          </button>
        )}
        {tab === 'pick' && (
          <button
            type="button"
            onClick={handlePick}
            disabled={!selectedCatalogId || catalogLoading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {saveLabel}
          </button>
        )}
        {tab === 'paste' && (
          <button
            type="button"
            onClick={handlePaste}
            disabled={!/^[0-9a-f-]{36}$/i.test(proId.trim())}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {saveLabel}
          </button>
        )}
      </div>
    </div>
  );
}
