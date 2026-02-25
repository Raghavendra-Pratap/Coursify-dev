import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { LearnerView } from '@/components/LearnerView'

export default async function LearnPage({ params }: { params: { courseId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // TODO: Check if user is enrolled in the course
  // For MVP, allow access if course is published

  const { data: course } = await supabase
    .from('courses')
    .select('*')
    .eq('id', params.courseId)
    .single()

  if (!course || !course.is_published) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">{course.title}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <LearnerView courseId={params.courseId} userId={user.id} />
      </main>
    </div>
  )
}
