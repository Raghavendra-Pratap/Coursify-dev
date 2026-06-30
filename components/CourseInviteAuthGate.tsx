'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type CourseInviteAuthGateProps = {
  courseId: string;
  courseTitle: string;
  inviterName?: string;
};

export function CourseInviteAuthGate({ courseId, courseTitle, inviterName }: CourseInviteAuthGateProps) {
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setError('Sign-in is not configured.');
      return;
    }
    try {
      const returnPath = `/course/${encodeURIComponent(courseId)}`;
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
    <div className="min-h-screen bg-[#0B1018] flex flex-col items-center justify-center p-4 sm:p-8">
      <p className="text-[11px] tracking-[0.2em] text-[#7A8FA3] uppercase mb-6">Coursify · Invitation</p>

      <div className="w-full max-w-md rounded-[20px] border border-[#243040] bg-[#121A24] p-8 sm:p-10 shadow-2xl text-center">
        <div className="text-[10px] tracking-[0.18em] text-[#C67B4E] uppercase mb-4">Sign in required</div>
        <h1 className="text-xl sm:text-2xl font-serif text-[#E8A87C] italic leading-snug mb-3">{courseTitle}</h1>
        <p className="text-sm text-[#7A8FA3] leading-relaxed mb-8">
          {inviter
            ? `${inviter} invited you to this course. Sign in with Google to view your boarding pass and enroll.`
            : 'Sign in with Google to view your boarding pass and enroll in this course.'}
        </p>

        {error && (
          <p className="mb-4 text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={redirecting}
          className="w-full py-3.5 px-6 rounded-full bg-[#C67B4E] text-[#0B1018] font-bold hover:bg-[#E8A87C] transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {redirecting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {redirecting ? 'Redirecting…' : 'Sign in with Google'}
        </button>

        <p className="mt-6 text-xs text-[#5A6A7A] leading-relaxed">
          Use the same Google account your instructor invited. New to Coursify? Signing in creates your account automatically.
        </p>
      </div>

      <Link href="/" className="mt-8 text-xs text-[#5A6A7A] hover:text-[#7A8FA3] transition-colors">
        ← Back to Coursify
      </Link>
    </div>
  );
}
