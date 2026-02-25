'use client'

import type { Course } from '@/lib/types'

/**
 * Stub for root type-check only. Real component in coursify-app/components/CourseCard.tsx.
 */
export function CourseCard({ course }: { course: Course }) {
  return <div data-stub="CourseCard">{course.title}</div>
}
