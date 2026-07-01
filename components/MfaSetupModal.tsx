'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Loader2, ShieldCheck, X } from 'lucide-react';
import {
  getPrimaryVerifiedFactorId,
  listTotpFactors,
  startTotpEnrollment,
  unenrollTotpFactor,
  verifyTotpCode,
  type MfaFactor,
} from '@/lib/mfa';
import { MfaChallengePanel } from '@/components/MfaChallengePanel';
import { headerPrimaryBtn, headerSecondaryBtn } from '@/components/ui/theme-classes';

type EnrollData = {
  factorId: string;
  qrCode: string;
  secret: string;
};

type MfaSetupModalProps = {
  open: boolean;
  onClose: () => void;
  onStatusChange?: (enabled: boolean) => void;
};

export function MfaSetupModal({ open, onClose, onStatusChange }: MfaSetupModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<MfaFactor[]>([]);
  const [enroll, setEnroll] = useState<EnrollData | null>(null);
  const [enrollCode, setEnrollCode] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [disablingId, setDisablingId] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const factors = await listTotpFactors();
      setVerified(factors.verified);
      onStatusChange?.(factors.verified.length > 0);
      if (factors.unverified.length > 0) {
        setEnroll({
          factorId: factors.unverified[0].id,
          qrCode: '',
          secret: '',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load MFA status.');
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    if (!open) return;
    setEnroll(null);
    setEnrollCode('');
    void refresh();
  }, [open, refresh]);

  const handleStartEnroll = async () => {
    setError(null);
    setEnrolling(true);
    try {
      const data = await startTotpEnrollment();
      const totp = data.totp;
      if (!totp?.qr_code || !data.id) {
        throw new Error('Authenticator setup could not be started.');
      }
      setEnroll({
        factorId: data.id,
        qrCode: totp.qr_code,
        secret: totp.secret,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start authenticator setup.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enroll) return;
    setError(null);
    const trimmed = enrollCode.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError('Enter a valid 6-digit code.');
      return;
    }
    setEnrolling(true);
    try {
      await verifyTotpCode(enroll.factorId, trimmed);
      setEnroll(null);
      setEnrollCode('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code. Try again.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleDisable = async (factorId: string) => {
    setError(null);
    setDisablingId(factorId);
    try {
      await unenrollTotpFactor(factorId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disable authenticator.');
    } finally {
      setDisablingId(null);
    }
  };

  const handleCopySecret = async () => {
    if (!enroll?.secret) return;
    try {
      await navigator.clipboard.writeText(enroll.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch {
      setError('Could not copy secret to clipboard.');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="app-card rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-bold text-content">Two-factor authentication</h3>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-overlay rounded-lg text-content-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-content-secondary">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading…
          </div>
        ) : enroll ? (
          <div className="space-y-4">
            <p className="text-sm text-content-secondary">
              Scan this QR code with Google Authenticator, 1Password, Authy, or another TOTP app. Then enter the
              6-digit code to finish setup.
            </p>
            {enroll.qrCode ? (
              <div
                className="mx-auto w-fit rounded-xl border border-line bg-white p-3"
                dangerouslySetInnerHTML={{ __html: enroll.qrCode }}
              />
            ) : (
              <p className="text-sm text-content-muted">
                Continue enrollment using the code from the app you already scanned.
              </p>
            )}
            {enroll.secret && (
              <div className="surface-2 rounded-lg border border-line p-3">
                <p className="text-xs text-content-muted mb-1">Manual entry key</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-content break-all flex-1">{enroll.secret}</code>
                  <button type="button" onClick={handleCopySecret} className={headerSecondaryBtn}>
                    <Copy className="w-4 h-4" />
                    {copiedSecret ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
            {error && (
              <div className="p-3 bg-danger-subtle border border-danger/30 rounded-lg text-sm text-danger">{error}</div>
            )}
            <form onSubmit={handleVerifyEnroll} className="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={enrollCode}
                onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="app-input text-center text-lg tracking-[0.3em] font-mono"
                required
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEnroll(null);
                    setEnrollCode('');
                    setError(null);
                  }}
                  className={`flex-1 ${headerSecondaryBtn}`}
                  disabled={enrolling}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enrolling || enrollCode.length !== 6}
                  className={`flex-1 ${headerPrimaryBtn} disabled:opacity-50`}
                >
                  {enrolling ? 'Verifying…' : 'Enable 2FA'}
                </button>
              </div>
            </form>
          </div>
        ) : verified.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-content-secondary">
              Your account is protected with an authenticator app. You will be asked for a code when signing in.
            </p>
            <ul className="space-y-2">
              {verified.map((factor) => (
                <li
                  key={factor.id}
                  className="flex items-center justify-between gap-3 surface-2 border border-line rounded-lg px-3 py-2"
                >
                  <span className="text-sm text-content">
                    {factor.friendly_name || 'Authenticator app'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDisable(factor.id)}
                    disabled={disablingId === factor.id}
                    className={`${headerSecondaryBtn} c-btn-sm disabled:opacity-50`}
                  >
                    {disablingId === factor.id ? 'Removing…' : 'Remove'}
                  </button>
                </li>
              ))}
            </ul>
            {error && (
              <div className="p-3 bg-danger-subtle border border-danger/30 rounded-lg text-sm text-danger">{error}</div>
            )}
            <button type="button" onClick={handleStartEnroll} disabled={enrolling} className={`w-full ${headerSecondaryBtn}`}>
              {enrolling ? 'Starting…' : 'Add another authenticator'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-content-secondary">
              Add a second step at sign-in using an authenticator app. This works with Supabase Auth TOTP — no dashboard
              setup required.
            </p>
            {error && (
              <div className="p-3 bg-danger-subtle border border-danger/30 rounded-lg text-sm text-danger">{error}</div>
            )}
            <button
              type="button"
              onClick={handleStartEnroll}
              disabled={enrolling}
              className={`w-full ${headerPrimaryBtn} disabled:opacity-50`}
            >
              {enrolling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting setup…
                </>
              ) : (
                'Set up authenticator app'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}