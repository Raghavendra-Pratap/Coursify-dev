'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { verifyTotpCode } from '@/lib/mfa';
import { headerPrimaryBtn, headerSecondaryBtn } from '@/components/ui/theme-classes';

type MfaChallengePanelProps = {
  factorId: string;
  onSuccess: () => void | Promise<void>;
  onCancel?: () => void;
  title?: string;
  description?: string;
  submitLabel?: string;
};

export function MfaChallengePanel({
  factorId,
  onSuccess,
  onCancel,
  title = 'Two-factor authentication',
  description = 'Enter the 6-digit code from your authenticator app.',
  submitLabel = 'Verify',
}: MfaChallengePanelProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError('Enter a valid 6-digit code.');
      return;
    }
    setSubmitting(true);
    try {
      await verifyTotpCode(factorId, trimmed);
      await onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-content mb-1">{title}</h3>
        <p className="text-sm text-content-secondary">{description}</p>
      </div>
      {error && (
        <div className="p-3 bg-danger-subtle border border-danger/30 rounded-lg text-sm text-danger">
          {error}
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-content-secondary uppercase tracking-wider mb-1.5">
          Authentication code
        </label>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          className="app-input text-center text-lg tracking-[0.3em] font-mono"
          required
        />
      </div>
      <div className={`flex gap-3 ${onCancel ? '' : ''}`}>
        {onCancel && (
          <button type="button" onClick={onCancel} className={`flex-1 ${headerSecondaryBtn}`} disabled={submitting}>
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || code.length !== 6}
          className={`${onCancel ? 'flex-1' : 'w-full'} ${headerPrimaryBtn} disabled:opacity-50`}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying…
            </>
          ) : (
            submitLabel
          )}
        </button>
      </div>
    </form>
  );
}
