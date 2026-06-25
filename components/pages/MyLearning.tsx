'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, Play, CheckCircle, ChevronRight } from 'lucide-react';

interface MyLearningProps {
  setCurrentView: (view: string) => void;
  /** When provided, Start/Continue opens this course in the take-course view. */
  onStartCourse?: (courseId: string) => void;
}

type EnrolledCourse = {
  id: string;
  course_id: string;
  title: string;
  progress_percentage: number;
  completed_at: string | null;
};

import { fetchJsonCached, readClientCache } from '@/lib/client-fetch-cache';

export default function MyLearning({ setCurrentView, onStartCourse }: MyLearningProps) {
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = readClientCache<{ courses?: EnrolledCourse[] }>('learning:enrolled', 60_000);
    if (cached?.courses) {
      setCourses(cached.courses);
      setLoading(false);
    }
    const load = async () => {
      try {
        const { data } = await fetchJsonCached<{ courses?: EnrolledCourse[] }>('learning:enrolled', '/api/learning/enrolled');
        setCourses(Array.isArray(data.courses) ? data.courses : []);
      } catch {
        if (!cached?.courses) setCourses([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleContinue = (courseId: string) => {
    if (onStartCourse) {
      onStartCourse(courseId);
    } else {
      setCurrentView('courses');
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">My learning</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">Your enrolled courses. Continue where you left off.</p>

      {loading ? (
        <div className="text-gray-500 dark:text-gray-400">Loading…</div>
      ) : courses.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">No enrolled courses yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">When you’re invited to a course, it will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map((c) => (
            <div
              key={c.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{c.title}</h2>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex-1 max-w-xs h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all"
                      style={{ width: `${Math.min(100, c.progress_percentage)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{c.progress_percentage}%</span>
                  {c.completed_at && (
                    <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                      <CheckCircle className="w-4 h-4" /> Completed
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleContinue(c.course_id)}
                className="ml-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
              >
                {c.progress_percentage > 0 ? 'Continue' : 'Start'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
