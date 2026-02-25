import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { CourseForm } from '@/components/CourseForm'

export default async function NewCoursePage() {
  // TODO: Temporarily bypassing auth for demo - remove this later
  // const supabase = createClient()
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) {
  //   redirect('/auth/login')
  // }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Create New Course</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <CourseForm />
      </main>
    </div>
  )
}
