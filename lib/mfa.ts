import { supabase } from '@/lib/supabase';

export type MfaFactor = {
  id: string;
  friendly_name?: string;
  status: 'verified' | 'unverified';
};

export async function listTotpFactors(): Promise<{ verified: MfaFactor[]; unverified: MfaFactor[] }> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  const totp = (data?.totp ?? []) as MfaFactor[];
  return {
    verified: totp.filter((f) => f.status === 'verified'),
    unverified: totp.filter((f) => f.status === 'unverified'),
  };
}

export async function needsMfaChallenge(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return false;
  return data?.nextLevel === 'aal2' && data?.currentLevel !== 'aal2';
}

export async function startTotpEnrollment(friendlyName = 'Coursify Authenticator') {
  const { unverified } = await listTotpFactors();
  for (const factor of unverified) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName,
  });
  if (error) throw error;
  return data;
}

export async function verifyTotpCode(factorId: string, code: string) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
  if (error) throw error;
}

export async function unenrollTotpFactor(factorId: string) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

export async function getPrimaryVerifiedFactorId(): Promise<string | null> {
  const { verified } = await listTotpFactors();
  return verified[0]?.id ?? null;
}
