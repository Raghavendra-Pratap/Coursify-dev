import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { CourseCard } from '@/components/CourseCard'

export default async function DashboardPage() {
  // TODO: Temporarily bypassing auth for demo - remove this later
  // const supabase = createClient()
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) {
  //   redirect('/auth/login')
  // }

  // Mock data for demo purposes
  const courses: any[] = [
    {
      id: '1',
      title: 'Introduction to React',
      description: 'Learn the fundamentals of React development',
      is_published: true,
      updated_at: new Date().toISOString(),
    },
    {
      id: '2',
      title: 'Advanced JavaScript',
      description: 'Deep dive into modern JavaScript features',
      is_published: false,
      updated_at: new Date().toISOString(),
    },
  ]

  // TODO: Fetch courses from database
  // const { data: courses, error } = await supabase
  //   .from('courses')
  //   .select('*')
  //   .eq('created_by', user.id)
  //   .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Coursify LMS</h1>
          <div className="flex gap-4 items-center">
            <Link href="/dashboard/admin" className="text-sm text-gray-600 hover:text-gray-900">
              Admin
            </Link>
            <Link href="/dashboard/settings" className="text-sm text-gray-600 hover:text-gray-900">
              Settings
            </Link>
            <form action="/auth/logout" method="post">
              <button type="submit" className="text-sm text-gray-600 hover:text-gray-900">
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">My Courses</h2>
          <Link
            href="/dashboard/courses/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create New Course
          </Link>
        </div>

        {courses && courses.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course: any) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">You haven't created any courses yet.</p>
            <Link
              href="/dashboard/courses/new"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Your First Course
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
