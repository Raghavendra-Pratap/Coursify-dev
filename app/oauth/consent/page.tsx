'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/**
 * OAuth consent UI – path required by Supabase Auth (Authorization Path).
 * Users see this screen before being sent to the provider (e.g. Google).
 */
export default function OAuthConsentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinueWithGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : '';
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (err) {
        setError(err.message || 'Google sign-in failed');
        setLoading(false);
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900">Sign in to Coursify</h1>
          <p className="text-sm text-gray-600 mt-2">
            Coursify would like to sign you in with your Google account to access your courses and progress.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleContinueWithGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 font-medium text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Redirecting…' : 'Continue with Google'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="w-full py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        <p className="mt-6 text-xs text-gray-500 text-center">
          By continuing, you allow Coursify to use your Google account for sign-in only.
        </p>
      </div>
    </div>
  );
}
