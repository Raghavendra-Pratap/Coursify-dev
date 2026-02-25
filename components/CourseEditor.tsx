'use client'

import type { Course, Module } from '@/lib/types'

/**
 * Stub for root type-check only. Real component in coursify-app/components/CourseEditor.tsx.
 */
export function CourseEditor({ course, modules: _initialModules }: { course: Course; modules: Module[] }) {
  return <div data-stub="CourseEditor">{course.title}</div>
}
