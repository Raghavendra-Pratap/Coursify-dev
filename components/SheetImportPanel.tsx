'use client';

import React, { useCallback, useState } from 'react';
import { FileSpreadsheet, Loader2, X } from 'lucide-react';

interface SheetImportPanelProps {
  open: boolean;
  onClose: () => void;
  /** Called when a new draft course is created from the sheet. */
  onSuccess: (courseId: string) => void;
}

export function SheetImportPanel({ open, onClose, onSuccess }: SheetImportPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setLoading(false);
    setError(null);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleImport = async () => {
    if (!file) {
      setError('Choose a CSV file first.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set('sheet', file);
      const res = await fetch('/api/instructor/courses/import-from-sheet', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const json = (await res.json().catch(() => ({}))) as {
        courseId?: string;
        error?: string;
        details?: Array<{ row?: number; message?: string }> | string;
      };
      if (!res.ok) {
        const details = Array.isArray(json.details)
          ? json.details.map((d) => `Row ${d.row}: ${d.message}`).join('; ')
          : json.details || json.error;
        setError((details as string) || res.statusText || 'Import failed.');
        return;
      }
      if (json.courseId) {
        onSuccess(json.courseId);
        handleClose();
      } else {
        setError('Import succeeded but no course id was returned.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="app-card rounded-lg shadow-2xl w-full max-w-lg flex flex-col border border-line">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-[#34A853]" />
            <h3 className="text-xl font-bold text-content">Import from sheet</h3>
          </div>
          <button type="button" onClick={handleClose} className="p-2 rounded-lg hover:bg-overlay text-content-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-content-secondary">
            Upload a CSV that follows the Coursify course template. We create a new draft course with modules, lessons, and
            video segments from your sheet.
          </p>

          <a
            href="/course-import-template.csv"
            download="course-import-template.csv"
            className="inline-flex items-center gap-2 text-sm text-[#34A853] hover:underline font-medium"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Download CSV template
          </a>

          <div>
            <label className="block text-xs font-medium text-content-secondary uppercase tracking-wider mb-1.5">Course sheet (CSV)</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
              className="block w-full text-sm text-content-secondary file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#34A853]/15 file:text-[#34A853] hover:file:bg-[#34A853]/25"
            />
            {file && (
              <p className="mt-2 text-xs text-content-muted truncate" title={file.name}>
                Selected: {file.name}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-danger bg-danger-subtle px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-line flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 c-btn c-btn-ghost py-2.5"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!file || loading}
            onClick={() => void handleImport()}
            className="flex-1 c-btn c-btn-primary py-2.5 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Importing…' : 'Create draft course'}
          </button>
        </div>
      </div>
    </div>
  );
}
