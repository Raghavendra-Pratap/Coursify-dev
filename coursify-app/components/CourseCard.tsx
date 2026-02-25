import Link from 'next/link'
import type { Course } from '@/lib/types'

interface CourseCardProps {
  course: Course
}

export function CourseCard({ course }: CourseCardProps) {
  return (
    <Link href={`/dashboard/courses/${course.id}`}>
      <div className="bg-white border rounded-lg p-6 hover:shadow-lg transition-shadow">
        <h3 className="text-xl font-semibold mb-2">{course.title}</h3>
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {course.description || 'No description'}
        </p>
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>
            {course.is_published ? (
              <span className="text-green-600">Published</span>
            ) : (
              <span className="text-yellow-600">Draft</span>
            )}
          </span>
          <span>{new Date(course.updated_at).toLocaleDateString()}</span>
        </div>
      </div>
    </Link>
  )
}
