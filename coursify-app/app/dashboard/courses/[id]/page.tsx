import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { CourseEditor } from '@/components/CourseEditor'

export default async function CoursePage({ params }: { params: { id: string } }) {
  // TODO: Temporarily bypassing auth for demo - remove this later
  // const supabase = createClient()
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) {
  //   redirect('/auth/login')
  // }

  // Mock data for demo
  const course: any = {
    id: params.id,
    title: 'Introduction to React',
    description: 'Learn the fundamentals of React development',
    is_published: false,
  }

  const modules: any[] = [
    {
      id: '1',
      course_id: params.id,
      title: 'Getting Started',
      description: 'Introduction to React basics',
      order_index: 0,
    },
    {
      id: '2',
      course_id: params.id,
      title: 'Components',
      description: 'Building reusable components',
      order_index: 1,
    },
  ]

  // TODO: Fetch course with modules and lessons
  // const { data: course, error } = await supabase
  //   .from('courses')
  //   .select('*')
  //   .eq('id', params.id)
  //   .eq('created_by', user.id)
  //   .single()
  // if (error || !course) {
  //   return <div>Course not found</div>
  // }
  // const { data: modules } = await supabase
  //   .from('modules')
  //   .select('*')
  //   .eq('course_id', params.id)
  //   .order('order_index')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
              ← Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold mt-2">{course.title}</h1>
          </div>
          <div className="flex gap-4">
            <button className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
              Preview
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              {course.is_published ? 'Unpublish' : 'Publish'}
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <CourseEditor course={course} modules={modules || []} />
      </main>
    </div>
  )
}
