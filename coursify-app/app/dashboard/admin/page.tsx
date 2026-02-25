import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { AdminDashboard } from '@/components/AdminDashboard'

export default async function AdminPage() {
  // TODO: Temporarily bypassing auth for demo - remove this later
  // const supabase = createClient()
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) {
  //   redirect('/auth/login')
  // }

  // Mock user ID for demo
  const userId = 'demo-user-id'

  // TODO: Check if user has admin permissions
  // For MVP, all course creators are admins of their own courses

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <AdminDashboard userId={userId} />
      </main>
    </div>
  )
}
