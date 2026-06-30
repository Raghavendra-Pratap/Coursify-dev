'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import QRCode from 'react-qr-code';
import { ArrowRight, Loader2, Star } from 'lucide-react';
import {
  courseCode,
  courseInviteUrl,
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
}: CourseInviteBoardingPassProps) {
  const passenger = recipientName?.trim() || (recipientEmail ? titleCaseFromEmail(recipientEmail) : 'Guest');
  const code = courseCode(courseTitle, courseId);
  const enrollCode = enrollmentCode(recipientEmail || 'guest@coursify.app', courseId);
  const instructor = instructorInitials(inviterName);
  const cohortLabel = new Date().getFullYear().toString();
  const begins = formatBoardingDate(new Date());
  const destination = destinationLabel(courseTitle);
  const reserveBy = reserveByDate(30);
  const seat = enrollCode.split('-')[1]?.slice(0, 2) ?? '01';
  const hasCourseStats = moduleCount != null || lessonCount != null || durationLabel;
  const showRating = (ratingCount ?? 0) > 0 && avgRating != null;
  const courseUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
    return courseInviteUrl(courseId, origin);
  }, [courseId]);

  return (
    <div className="min-h-screen bg-[#0B1018] flex flex-col items-center justify-center p-4 sm:p-8">
      <p className="text-[11px] tracking-[0.2em] text-[#7A8FA3] uppercase mb-6">Coursify · Invitation</p>

      <div className="w-full rounded-[20px] border border-[#243040] overflow-hidden bg-[#121A24] shadow-2xl" style={{ maxWidth: PASS_MAX_WIDTH }}>
        <div className="flex flex-col md:flex-row">
          <div className="flex-1 p-7 sm:p-9 md:p-10 md:pr-8">
            <div className="text-[10px] tracking-[0.18em] text-[#C67B4E] uppercase mb-3">Invitation · Coursify</div>
            <div className="text-2xl sm:text-[28px] leading-tight text-[#C67B4E] font-serif mb-1">{passenger}</div>
            <div className="text-xs text-[#7A8FA3] mb-2">you&apos;re invited to join</div>
            <div className="text-xl sm:text-[22px] leading-snug text-[#E8A87C] italic font-serif mb-5">{courseTitle}</div>

            {description && (
              <p className="text-sm text-[#7A8FA3] leading-relaxed mb-6 line-clamp-3">{description}</p>
            )}

            <div className="flex items-center gap-4 sm:gap-8 mb-6 w-full">
              <div className="flex-1 min-w-0">
                <div className="text-[9px] tracking-[0.12em] text-[#7A8FA3] mb-1 uppercase">Cohort begins</div>
                <div className="text-lg font-bold text-[#F4F7FA]">{begins}</div>
              </div>
              <div className="w-9 h-9 rounded-full border border-[#C67B4E] flex items-center justify-center text-[#C67B4E] text-base shrink-0">→</div>
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
                  fgColor="#0B1018"
                  aria-label="QR code for course invitation link"
                />
              </div>

              <div className="flex-1 min-w-0 space-y-4 w-full">
                {hasCourseStats && (
                  <div className={`grid gap-x-4 gap-y-3 ${showRating ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                    <GridCell label="Modules" value={String(moduleCount ?? 0)} compact />
                    <GridCell label="Lessons" value={String(lessonCount ?? 0)} compact />
                    <GridCell label="Duration" value={durationLabel || '0m'} compact />
                    {showRating && (
                      <div>
                        <div className="text-[9px] tracking-[0.12em] text-[#7A8FA3] mb-1 uppercase">Rating</div>
                        <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#F4F7FA] tracking-wide">
                          <Star className="w-3.5 h-3.5 text-[#E8A87C] fill-[#E8A87C]" aria-hidden />
                          <span>{avgRating!.toFixed(1)}</span>
                          <span className="text-[#7A8FA3] font-normal text-xs">({ratingCount})</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                  <GridCell label="Cohort" value={cohortLabel} compact />
                  <GridCell label="Course" value={code} compact />
                  <GridCell label="Seat" value={`${seat}A`} compact />
                  <GridCell label="Instructor" value={instructor} compact />
                </div>
              </div>
            </div>
          </div>

          <div className="md:w-[26%] min-w-[220px] p-7 sm:p-8 bg-[#0E1520] border-t md:border-t-0 md:border-l-2 border-dashed border-[#3A4A5C] flex flex-col justify-between min-h-[320px]">
            <div>
              <div className="w-7 h-7 rounded-full border border-[#C67B4E] flex items-center justify-center text-[#C67B4E] text-sm mb-5">↗</div>
              {inviterName?.trim() ? (
                <div className="mb-6">
                  <div className="text-[9px] tracking-[0.12em] text-[#7A8FA3] mb-1 uppercase">Invited by</div>
                  <div className="text-sm font-bold text-[#E8A87C] leading-snug line-clamp-2">{inviterName.trim()}</div>
                </div>
              ) : null}
              <div className="text-[9px] tracking-[0.12em] text-[#7A8FA3] mb-1 uppercase">Course code</div>
              <div className="text-xl font-bold text-[#F4F7FA]">{code}</div>
            </div>

            <div className="flex justify-center py-2">
              {signedIn && autoEnrolled !== true && onEnroll ? (
                <button
                  type="button"
                  onClick={onEnroll}
                  disabled={enrolling}
                  className="w-[52px] h-[52px] rounded-full bg-[#C67B4E] text-[#0B1018] text-2xl font-bold flex items-center justify-center hover:bg-[#E8A87C] transition-colors disabled:opacity-70"
                  aria-label="Enroll in course"
                >
                  {enrolling ? <Loader2 className="w-5 h-5 animate-spin" /> : '→'}
                </button>
              ) : (
                <Link
                  href={signInHref}
                  className="w-[52px] h-[52px] rounded-full bg-[#C67B4E] text-[#0B1018] text-2xl font-bold flex items-center justify-center hover:bg-[#E8A87C] transition-colors"
                  aria-label="Sign in to enroll"
                >
                  →
                </Link>
              )}
            </div>

            <div className="space-y-5 pt-2">
              <div>
                <div className="text-[9px] tracking-[0.12em] text-[#7A8FA3] mb-1 uppercase">Enrollment code</div>
                <div className="text-xs font-bold text-[#E8A87C] tracking-wider">{enrollCode}</div>
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
          <div className="rounded-2xl border border-[#243040] bg-[#121A24] p-6">
            <p className="font-semibold text-[#E8A87C] mb-2">You&apos;re enrolled</p>
            <p className="text-sm text-[#7A8FA3] mb-4">Your seat is confirmed. Open Coursify to start learning.</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#C67B4E] text-[#0B1018] font-bold rounded-full hover:bg-[#E8A87C] transition-colors"
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
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#C67B4E] text-[#0B1018] font-bold rounded-full hover:bg-[#E8A87C] transition-colors disabled:opacity-70"
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
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#C67B4E] text-[#0B1018] font-bold rounded-full hover:bg-[#E8A87C] transition-colors"
            >
              Accept invitation →
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="mt-4 text-xs text-[#7A8FA3] leading-relaxed max-w-md mx-auto">
              Sign in with the email address your instructor invited to join this course.
            </p>
          </>
        )}
      </div>

      <Link href="/" className="mt-8 text-xs text-[#5A6A7A] hover:text-[#7A8FA3] transition-colors">
        ← Back to Coursify
      </Link>
    </div>
  );
}
