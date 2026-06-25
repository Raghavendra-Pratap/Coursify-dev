'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Award, Info, Loader2, X } from 'lucide-react';

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

interface AddAssessmentModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (assessment: AssessmentContentPayload) => void;
}

const AP_ORIGIN =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_ASSESSMENT_PRO_ORIGIN
    ? process.env.NEXT_PUBLIC_ASSESSMENT_PRO_ORIGIN.replace(/\/+$/, '')
    : 'https://assessments.bsoc.space';

function resetFields() {
  return {
    tab: 'pick' as TabId,
    accessMode: 'lms_embed' as 'lms_embed' | 'proctored_portal',
    title: '',
    description: '',
    proId: '',
    passingScore: 70,
    durationMinutes: 15,
    catalog: [] as CatalogItem[],
    selectedCatalogId: '',
    builderUrl: null as string | null,
    builderAssessmentId: null as string | null,
    error: null as string | null,
    loading: false,
    catalogLoading: false,
  };
}

export function AddAssessmentModal({ open, onClose, onAdd }: AddAssessmentModalProps) {
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const close = useCallback(() => {
    const r = resetFields();
    setTab(r.tab);
    setAccessMode(r.accessMode);
    setTitle(r.title);
    setDescription(r.description);
    setProId(r.proId);
    setPassingScore(r.passingScore);
    setDurationMinutes(r.durationMinutes);
    setCatalog(r.catalog);
    setSelectedCatalogId(r.selectedCatalogId);
    setBuilderUrl(r.builderUrl);
    setBuilderAssessmentId(r.builderAssessmentId);
    setError(r.error);
    setLoading(r.loading);
    setCatalogLoading(r.catalogLoading);
    onClose();
  }, [onClose]);

  const finishAdd = useCallback(
    (payload: AssessmentContentPayload) => {
      onAdd(payload);
      close();
    },
    [onAdd, close]
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
      setError('Failed to load assessments');
      setCatalog([]);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (tab === 'pick') void loadCatalog(accessMode);
  }, [open, tab, accessMode, loadCatalog]);

  useEffect(() => {
    if (!open || tab !== 'builder' || builderUrl) return;

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
  }, [open, tab, builderUrl, accessMode, title, description, passingScore, finishAdd]);

  const startBuilder = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/instructor/assessments/builder-session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessMode,
          title: title.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? 'Failed to open builder');
        return;
      }
      const session = data as { embedBuilderUrl?: string; assessmentId?: string };
      setBuilderUrl(session.embedBuilderUrl ?? null);
      setBuilderAssessmentId(session.assessmentId ?? null);
    } catch {
      setError('Failed to open builder');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && tab === 'builder' && !builderUrl && !loading) {
      void startBuilder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

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
      setError('Publish in the builder first, or wait for the save confirmation.');
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

  if (!open) return null;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'pick', label: 'Pick existing' },
    { id: 'create', label: 'Create simple' },
    { id: 'builder', label: 'Design in AP' },
    { id: 'paste', label: 'Paste UUID' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full border border-gray-200 dark:border-gray-700 flex flex-col ${
          tab === 'builder' && builderUrl ? 'max-w-5xl max-h-[92vh]' : 'max-w-2xl'
        }`}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-indigo-600" />
            Add Assessment
          </h3>
          <button type="button" onClick={close} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-6 h-6 dark:text-gray-200" />
          </button>
        </div>

        <div className="px-6 pt-4 flex-shrink-0">
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

          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Assessment type</label>
            <select
              value={accessMode}
              onChange={(e) => {
                setAccessMode(e.target.value as 'lms_embed' | 'proctored_portal');
                setSelectedCatalogId('');
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
            >
              <option value="lms_embed">Module quiz (embedded)</option>
              <option value="proctored_portal">Final exam (new tab)</option>
            </select>
          </div>
        </div>

        <div className="px-6 pb-6 overflow-y-auto flex-1 min-h-0">
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
          )}

          {tab === 'pick' && (
            <div className="space-y-4">
              {catalogLoading ? (
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading assessments…
                </p>
              ) : catalog.length === 0 ? (
                <p className="text-sm text-gray-500">No assessments found for this type. Try Create simple or Design in AP.</p>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Assessment</label>
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
                    <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Display title (optional)</label>
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
            <div className="space-y-4">
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
                <div className="flex items-start gap-2 text-sm text-indigo-900 dark:text-indigo-200">
                  <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>Creates a starter quiz in Assessment Pro with one sample question. Edit later in the AP builder.</p>
                </div>
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
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Design questions in Assessment Pro. Click <strong>Publish</strong> in the builder to link this assessment to your lesson.
              </p>
              {loading && !builderUrl && (
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Opening builder…
                </p>
              )}
              {builderUrl && (
                <iframe
                  src={builderUrl}
                  title="Assessment Pro builder"
                  className="w-full flex-1 min-h-[45vh] border border-gray-200 dark:border-gray-600 rounded-xl"
                  allow="clipboard-read; clipboard-write"
                />
              )}
            </div>
          )}

          {tab === 'paste' && (
            <div className="space-y-4">
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

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={close}
            className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-xl font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          {tab === 'pick' && (
            <button
              type="button"
              onClick={handlePick}
              disabled={!selectedCatalogId || catalogLoading}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              Add Assessment
            </button>
          )}
          {tab === 'create' && (
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={loading || !title.trim()}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create & Add'}
            </button>
          )}
          {tab === 'builder' && (
            <button
              type="button"
              onClick={handleBuilderDone}
              disabled={!builderAssessmentId}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              Use draft assessment
            </button>
          )}
          {tab === 'paste' && (
            <button
              type="button"
              onClick={handlePaste}
              disabled={!/^[0-9a-f-]{36}$/i.test(proId.trim())}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              Add Assessment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
