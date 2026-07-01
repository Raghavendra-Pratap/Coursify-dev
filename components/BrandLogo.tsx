'use client';

import React from 'react';
import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import { ROUTES } from '@/lib/site-urls';

type BrandLogoProps = {
  /** Icon-only mark, or mark + wordmark */
  variant?: 'mark' | 'wordmark';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
  /** When set, wraps the logo in a link to the marketing home page */
  linkToHome?: boolean;
};

const MARK_PX = { sm: 28, md: 36, lg: 44 } as const;

export function BrandMark({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect x="0" y="0" width="80" height="80" rx="14" fill={BRAND.markBg} stroke={BRAND.markBorder} strokeWidth="0.75" />
      <polyline points="16,26 30,40 16,54" fill="none" stroke={BRAND.accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="32,26 46,40 32,54" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="68" cy="68" r="6" fill={BRAND.accent} />
    </svg>
  );
}

export function NavBrand({ className = '', href = ROUTES.home }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={`c-nav-logo ${className}`} title="Coursify home">
      <svg className="c-nav-logo-mark" viewBox="0 0 16 16" fill="none" aria-hidden>
        <polyline
          points="1,5 6,8 1,11"
          stroke={BRAND.accent}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="7,5 12,8 7,11"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-content opacity-70"
        />
        <circle cx="14.5" cy="14.5" r="1.5" fill={BRAND.accent} />
      </svg>
      <span>Coursify</span>
    </Link>
  );
}

export default function BrandLogo({
  variant = 'wordmark',
  size = 'md',
  showTagline = false,
  className = '',
  linkToHome = false,
}: BrandLogoProps) {
  const markSize = MARK_PX[size];

  const inner =
    variant === 'mark' ? (
      <div className={`flex-shrink-0 ${className}`} title="Coursify">
        <BrandMark size={markSize} />
      </div>
    ) : (
      <div className={`flex items-center gap-2.5 min-w-0 ${className}`} title="Coursify">
        <BrandMark size={markSize} />
        <div className="min-w-0 leading-tight">
          <span className="font-mono font-medium text-content block text-base sm:text-lg tracking-wide">
            Coursify
          </span>
          {showTagline && (
            <span className="font-mono text-[9px] sm:text-[10px] font-light text-brand tracking-[0.15em] uppercase block truncate">
              LMS
            </span>
          )}
        </div>
      </div>
    );

  if (linkToHome) {
    return (
      <Link href={ROUTES.home} className="inline-flex min-w-0" title="Coursify home">
        {inner}
      </Link>
    );
  }

  return inner;
}
