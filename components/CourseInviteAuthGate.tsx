'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { supabase } from '@/lib/supabase';
import { persistSessionMode, stashLandingIntent } from '@/lib/session-mode';

type CourseInviteAuthGateProps = {
  courseId?: string;
  programId?: string;
  courseTitle: string;
  inviterName?: string;
};

export function CourseInviteAuthGate({ courseId, programId, courseTitle, inviterName }: CourseInviteAuthGateProps) {
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setError('Sign-in is not configured.');
      return;
    }
    try {
      stashLandingIntent('learner');
      const returnPath = programId
        ? `/program/${encodeURIComponent(programId)}`
        : `/course/${encodeURIComponent(courseId ?? '')}`;
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnPath)}`;
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (oauthError) {
        setError(oauthError.message || 'Google sign-in failed');
        return;
      }
      if (data?.url) {
        setRedirecting(true);
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  };

  const inviter = inviterName?.trim();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-canvas">
      <div className="mb-8">
        <BrandLogo size="lg" showTagline />
      </div>

      <div className="w-full max-w-md rounded-xl app-card p-8 sm:p-10 shadow-2xl text-center">
        <div className="section-label mb-4">Sign in required</div>
        <h1 className="text-xl sm:text-2xl font-sans font-semibold leading-snug mb-3 text-content">{courseTitle}</h1>
        <p className="text-sm leading-relaxed mb-8 text-content-secondary">
          {inviter
            ? `${inviter} invited you to ${programId ? 'this program' : 'this course'}. Sign in with Google to accept your invitation.`
            : `Sign in with Google to enroll in this ${programId ? 'program' : 'course'}.`}
        </p>

        {error && (
          <p className="mb-4 text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={redirecting}
          className="w-full btn-brand py-3.5 disabled:opacity-70 tracking-wide uppercase text-sm"
        >
          {redirecting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {redirecting ? 'Redirecting…' : 'Sign in with Google'}
        </button>

        <p className="mt-6 text-xs leading-relaxed text-content-muted">
          Use the same Google account your instructor invited. New to Coursify? Signing in creates your account automatically.
        </p>
      </div>

      <Link href="/home" className="mt-8 text-xs transition-colors text-content-muted hover:text-content-secondary">
        ← Back to Coursify
      </Link>
    </div>
  );
}
