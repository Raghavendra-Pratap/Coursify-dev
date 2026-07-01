'use client';

import Link from 'next/link';
import { loginPath } from '@/lib/site-urls';
import BrandLogo from '@/components/BrandLogo';
import { useMemo } from 'react';
import QRCode from 'react-qr-code';
import { ArrowRight, Loader2, Star } from 'lucide-react';
import {
  courseCode,
  courseInviteUrl,
  programInviteUrl,
  destinationLabel,
  enrollmentCode,
  formatBoardingDate,
  instructorInitials,
  reserveByDate,
  titleCaseFromEmail,
} from '@/lib/email/boarding-pass-invite';

const PASS_MAX_WIDTH = '900px';

export type CourseInviteBoardingPassProps = {
  courseTitle: string;
  courseId: string;
  description?: string | null;
  inviterName?: string;
  recipientEmail?: string;
  recipientName?: string;
  lessonCount?: number;
  moduleCount?: number;
  durationLabel?: string;
  avgRating?: number;
  ratingCount?: number;
  signedIn: boolean;
  enrolling?: boolean;
  enrollError?: string | null;
  autoEnrolled?: boolean | null;
  onEnroll?: () => void;
  signInHref: string;
  /** Multi-course program invite */
  variant?: 'course' | 'program';
  programCourses?: { id: string; title: string }[];
  invitePageUrl?: string;
};

function GridCell({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={compact ? '' : 'pr-4 border-r border-[#243040] last:border-r-0'}>
      <div className="text-[9px] tracking-[0.12em] text-[#7A8FA3] mb-1 uppercase">{label}</div>
      <div className="text-[13px] font-bold text-[#F4F7FA] tracking-wide">{value}</div>
    </div>
  );
}

export function CourseInviteBoardingPass({
  courseTitle,
  courseId,
  description,
  inviterName,
  recipientEmail,
  recipientName,
  lessonCount,
  moduleCount,
  durationLabel,
  avgRating,
  ratingCount,
  signedIn,
  enrolling,
  enrollError,
  autoEnrolled,
  onEnroll,
  signInHref,
  variant = 'course',
  programCourses,
  invitePageUrl,
}: CourseInviteBoardingPassProps) {
  const isProgram = variant === 'program';
  const passenger = recipientName?.trim() || (recipientEmail ? titleCaseFromEmail(recipientEmail) : 'Guest');
  const code = courseCode(courseTitle, courseId);
  const enrollCode = enrollmentCode(recipientEmail || 'guest@coursify.app', courseId);
  const instructor = instructorInitials(inviterName);
  const cohortLabel = new Date().getFullYear().toString();
  const begins = formatBoardingDate(new Date());
  const destination = destinationLabel(courseTitle);
  const reserveBy = reserveByDate(30);
  const seat = enrollCode.split('-')[1]?.slice(0, 2) ?? '01';
  const hasCourseStats = isProgram || moduleCount != null || lessonCount != null || durationLabel;
  const showRating = !isProgram && (ratingCount ?? 0) > 0 && avgRating != null;
  const courseUrl = useMemo(() => {
    if (invitePageUrl) return invitePageUrl;
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
    return isProgram ? programInviteUrl(courseId, origin) : courseInviteUrl(courseId, origin);
  }, [courseId, invitePageUrl, isProgram]);

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="mb-6">
        <BrandLogo size="lg" showTagline />
      </div>

      <div className="w-full rounded-[20px] border border-[#243040] overflow-hidden bg-[#0f0f0f] shadow-2xl" style={{ maxWidth: PASS_MAX_WIDTH }}>
        <div className="flex flex-col md:flex-row">
          <div className="flex-1 p-7 sm:p-9 md:p-10 md:pr-8">
            <div className="text-[10px] tracking-[0.18em] text-[#ff6b35] uppercase mb-3">{isProgram ? 'Program invitation · Coursify' : 'Invitation · Coursify'}</div>
            <div className="text-2xl sm:text-[28px] leading-tight text-[#ff6b35] font-serif mb-1">{passenger}</div>
            <div className="text-xs text-[#7A8FA3] mb-2">you&apos;re invited to join</div>
            <div className="text-xl sm:text-[22px] leading-snug text-[#ff8c5a] italic font-serif mb-5">{courseTitle}</div>

            {description && (
              <p className="text-sm text-[#7A8FA3] leading-relaxed mb-6 line-clamp-3">{description}</p>
            )}

            {isProgram && programCourses && programCourses.length > 0 && (
              <div className="mb-6">
                <div className="text-[9px] tracking-[0.12em] text-[#7A8FA3] mb-2 uppercase">Included courses</div>
                <ul className="space-y-1.5">
                  {programCourses.map((c, i) => (
                    <li key={c.id} className="text-sm text-[#F4F7FA] flex gap-2">
                      <span className="text-[#ff8c5a] font-bold">{i + 1}.</span>
                      <span className="line-clamp-1">{c.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-4 sm:gap-8 mb-6 w-full">
              <div className="flex-1 min-w-0">
                <div className="text-[9px] tracking-[0.12em] text-[#7A8FA3] mb-1 uppercase">Cohort begins</div>
                <div className="text-lg font-bold text-[#F4F7FA]">{begins}</div>
              </div>
              <div className="w-9 h-9 rounded-full border border-[#ff6b35] flex items-center justify-center text-[#ff6b35] text-base shrink-0">→</div>
              <div className="flex-1 min-w-0 text-right">
                <div className="text-[9px] tracking-[0.12em] text-[#7A8FA3] mb-1 uppercase">Destination</div>
                <div className="text-lg font-bold text-[#F4F7FA] leading-snug line-clamp-2">{destination}</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
              <div className="bg-white p-2.5 rounded-lg shrink-0 shadow-sm">
                <QRCode
                  value={courseUrl}
                  size={108}
                  level="M"
                  bgColor="#FFFFFF"
                  fgColor="#080808"
                  aria-label="QR code for course invitation link"
                />
              </div>

              <div className="flex-1 min-w-0 space-y-4 w-full">
                {hasCourseStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                    {isProgram ? (
                      <GridCell label="Courses" value={String(programCourses?.length ?? 0)} compact />
                    ) : (
                      <GridCell label="Modules" value={String(moduleCount ?? 0)} compact />
                    )}
                    <GridCell label="Lessons" value={String(lessonCount ?? 0)} compact />
                    <GridCell label="Duration" value={durationLabel || '0m'} compact />
                    {showRating && (
                      <div>
                        <div className="text-[9px] tracking-[0.12em] text-[#7A8FA3] mb-1 uppercase">Rating</div>
                        <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#F4F7FA] tracking-wide">
                          <Star className="w-3.5 h-3.5 text-[#ff8c5a] fill-[#ff8c5a]" aria-hidden />
                          <span>{avgRating!.toFixed(1)}</span>
                          <span className="text-[#7A8FA3] font-normal text-xs">({ratingCount})</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                  <GridCell label="Cohort" value={cohortLabel} compact />
                  <GridCell label={isProgram ? 'Program' : 'Course'} value={code} compact />
                  <GridCell label="Seat" value={`${seat}A`} compact />
                  <GridCell label="Instructor" value={instructor} compact />
                </div>
              </div>
            </div>
          </div>

          <div className="md:w-[26%] min-w-[220px] p-7 sm:p-8 bg-[#0E1520] border-t md:border-t-0 md:border-l-2 border-dashed border-[#3A4A5C] flex flex-col justify-between min-h-[320px]">
            <div>
              <div className="w-7 h-7 rounded-full border border-[#ff6b35] flex items-center justify-center text-[#ff6b35] text-sm mb-5">↗</div>
              {inviterName?.trim() ? (
                <div className="mb-6">
                  <div className="text-[9px] tracking-[0.12em] text-[#7A8FA3] mb-1 uppercase">Invited by</div>
                  <div className="text-sm font-bold text-[#ff8c5a] leading-snug line-clamp-2">{inviterName.trim()}</div>
                </div>
              ) : null}
              <div className="text-[9px] tracking-[0.12em] text-[#7A8FA3] mb-1 uppercase">{isProgram ? 'Program code' : 'Course code'}</div>
              <div className="text-xl font-bold text-[#F4F7FA]">{code}</div>
            </div>

            <div className="flex justify-center py-2">
              {signedIn && autoEnrolled !== true && onEnroll ? (
                <button
                  type="button"
                  onClick={onEnroll}
                  disabled={enrolling}
                  className="w-[52px] h-[52px] rounded-full text-2xl font-bold flex items-center justify-center border transition-colors disabled:opacity-70"
                  style={{
                    borderColor: 'var(--c-accent-br)',
                    background: 'var(--c-accent-bg)',
                    color: 'var(--c-accent)',
                  }}
                  aria-label="Enroll in course"
                >
                  {enrolling ? <Loader2 className="w-5 h-5 animate-spin" /> : '→'}
                </button>
              ) : (
                <Link
                  href={signInHref}
                  className="w-[52px] h-[52px] rounded-full text-2xl font-bold flex items-center justify-center border transition-colors"
                  style={{
                    borderColor: 'var(--c-accent-br)',
                    background: 'var(--c-accent-bg)',
                    color: 'var(--c-accent)',
                  }}
                  aria-label="Sign in to enroll"
                >
                  →
                </Link>
              )}
            </div>

            <div className="space-y-5 pt-2">
              <div>
                <div className="text-[9px] tracking-[0.12em] text-[#7A8FA3] mb-1 uppercase">Enrollment code</div>
                <div className="text-xs font-bold text-[#ff8c5a] tracking-wider">{enrollCode}</div>
              </div>
              <div>
                <div className="text-[9px] tracking-[0.12em] text-[#7A8FA3] mb-1 uppercase">Reserve by</div>
                <div className="text-sm font-bold text-[#F4F7FA]">{reserveBy}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full mt-6 text-center" style={{ maxWidth: PASS_MAX_WIDTH }}>
        {signedIn && autoEnrolled === true ? (
          <div className="rounded-2xl border border-[#243040] bg-[#0f0f0f] p-6">
            <p className="font-semibold text-[#ff8c5a] mb-2">You&apos;re enrolled</p>
            <p className="text-sm text-[#7A8FA3] mb-4">
              {isProgram
                ? `You're enrolled in all ${programCourses?.length ?? ''} courses. Open Coursify to start learning.`
                : 'Your seat is confirmed. Open Coursify to start learning.'}
            </p>
            <Link
              href={loginPath({ landing: 'learner', view: 'courses' })}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-bold border transition-colors"
              style={{
                borderColor: 'var(--c-accent-br)',
                background: 'var(--c-accent-bg)',
                color: 'var(--c-accent)',
              }}
            >
              Open Coursify <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : signedIn ? (
          <>
            <button
              type="button"
              onClick={onEnroll}
              disabled={enrolling}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-bold border transition-colors disabled:opacity-70"
                  style={{
                    borderColor: 'var(--c-accent-br)',
                    background: 'var(--c-accent-bg)',
                    color: 'var(--c-accent)',
                  }}
            >
              {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {enrolling ? 'Enrolling…' : 'Accept invitation →'}
              {!enrolling && <ArrowRight className="w-4 h-4" />}
            </button>
            {enrollError && <p className="mt-3 text-sm text-red-400">{enrollError}</p>}
            {recipientEmail && (
              <p className="mt-4 text-xs text-[#7A8FA3]">
                Signed in as <span className="text-[#F4F7FA]">{recipientEmail}</span>
              </p>
            )}
          </>
        ) : (
          <>
            <Link
              href={signInHref}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-bold border transition-colors"
              style={{
                borderColor: 'var(--c-accent-br)',
                background: 'var(--c-accent-bg)',
                color: 'var(--c-accent)',
              }}
            >
              Accept invitation →
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="mt-4 text-xs text-[#7A8FA3] leading-relaxed max-w-md mx-auto">
              Sign in with the email address your instructor invited to join this {isProgram ? 'program' : 'course'}.
            </p>
          </>
        )}
      </div>

      <Link href="/home" className="mt-8 text-xs text-[#5A6A7A] hover:text-[#7A8FA3] transition-colors">
        ← Back to Coursify
      </Link>
    </div>
  );
}
