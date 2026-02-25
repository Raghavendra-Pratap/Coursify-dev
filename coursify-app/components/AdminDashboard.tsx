'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import type { Course, Enrollment, Progress } from '@/lib/types'

interface AdminDashboardProps {
  userId: string
}

export function AdminDashboard({ userId }: AdminDashboardProps) {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadCourses()
  }, [userId])

  useEffect(() => {
    if (selectedCourse) {
      loadEnrollments(selectedCourse)
    }
  }, [selectedCourse])

  const loadCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (data) {
        setCourses(data)
        if (data.length > 0 && !selectedCourse) {
          setSelectedCourse(data[0].id)
        }
      }
    } catch (err) {
      console.error('Error loading courses:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadEnrollments = async (courseId: string) => {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select('*')
        .eq('course_id', courseId)

      if (error) throw error
      if (data) {
        setEnrollments(data)
      }
    } catch (err) {
      console.error('Error loading enrollments:', err)
    }
  }

  const handleExport = async () => {
    if (!selectedCourse) return

    try {
      // TODO: Implement Excel export
      // For now, export as CSV
      const course = courses.find(c => c.id === selectedCourse)
      if (!course) return

      const csv = [
        ['Learner Email', 'Progress %', 'Enrolled', 'Completed'],
        ...enrollments.map(e => [
          e.user_id, // TODO: Get actual email from users table
          e.progress_percentage.toString(),
          new Date(e.enrolled_at).toLocaleDateString(),
          e.completed_at ? new Date(e.completed_at).toLocaleDateString() : 'In Progress',
        ]),
      ].map(row => row.join(',')).join('\n')

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${course.title}_progress.csv`
      a.click()
    } catch (err) {
      console.error('Error exporting:', err)
      alert('Failed to export data')
    }
  }

  if (loading) {
    return <div>Loading dashboard...</div>
  }

  const selectedCourseData = courses.find(c => c.id === selectedCourse)
  const completionRate = enrollments.length > 0
    ? (enrollments.filter(e => e.completed_at).length / enrollments.length) * 100
    : 0

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Course Analytics</h2>
        {selectedCourse && (
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Export to Excel
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Courses</h3>
          <p className="text-3xl font-bold">{courses.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Learners</h3>
          <p className="text-3xl font-bold">{enrollments.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Completion Rate</h3>
          <p className="text-3xl font-bold">{completionRate.toFixed(1)}%</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Select Course</h3>
        <select
          value={selectedCourse || ''}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="">Select a course...</option>
          {courses.map(course => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
      </div>

      {selectedCourseData && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            {selectedCourseData.title} - Learner Progress
          </h3>
          {enrollments.length === 0 ? (
            <p className="text-gray-600">No learners enrolled yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Learner</th>
                    <th className="text-left py-2">Progress</th>
                    <th className="text-left py-2">Enrolled</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map(enrollment => (
                    <tr key={enrollment.id} className="border-b">
                      <td className="py-2">{enrollment.user_id}</td>
                      <td className="py-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${enrollment.progress_percentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">
                          {enrollment.progress_percentage}%
                        </span>
                      </td>
                      <td className="py-2">
                        {new Date(enrollment.enrolled_at).toLocaleDateString()}
                      </td>
                      <td className="py-2">
                        {enrollment.completed_at ? (
                          <span className="text-green-600">Completed</span>
                        ) : (
                          <span className="text-yellow-600">In Progress</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
