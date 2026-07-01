import Link from 'next/link';
import { BookOpen, ChevronRight, Video } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { loginPath } from '@/lib/site-urls';

export default function MarketingHomePage() {
  return (
    <div className="min-h-screen bg-canvas text-content">
      <header className="c-nav border-b border-line">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-4">
          <Link href="/home" className="c-nav-logo" title="Coursify home">
            <BrandLogo size="sm" />
          </Link>
          <Link href={loginPath()} className="c-btn c-btn-primary c-btn-sm font-semibold">
            Log in
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16 sm:py-24">
        <div className="max-w-2xl">
          <p className="section-label mb-4">Micro-video learning platform</p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-content mb-4">
            The LMS that evolves with you
          </h1>
          <p className="text-lg text-content-secondary mb-8 leading-relaxed">
            Build and take courses with micro-videos, quizzes, and progress tracking — without
            re-recording entire lessons when content changes.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href={loginPath({ landing: 'learner' })} className="c-btn c-btn-primary c-btn-lg font-semibold">
              Start learning
              <ChevronRight className="w-5 h-5" />
            </Link>
            <Link href={loginPath({ landing: 'instructor' })} className="c-btn c-btn-ghost c-btn-lg font-semibold">
              I&apos;m an instructor
            </Link>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-16">
          <div className="app-card p-6">
            <Video className="w-8 h-8 text-accent mb-3" />
            <h2 className="font-semibold text-content mb-2">For instructors</h2>
            <p className="text-sm text-content-secondary">
              Create modules, clip video segments, invite learners, and track completion.
            </p>
          </div>
          <div className="app-card p-6">
            <BookOpen className="w-8 h-8 text-accent mb-3" />
            <h2 className="font-semibold text-content mb-2">For learners</h2>
            <p className="text-sm text-content-secondary">
              Enroll from an invite link, sign in once, and continue where you left off.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-line py-8 px-6 text-center text-sm text-content-muted">
        <Link href={loginPath()} className="text-accent hover:underline">
          Log in to Coursify
        </Link>
      </footer>
    </div>
  );
}
