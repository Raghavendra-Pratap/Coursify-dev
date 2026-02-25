import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

export default async function Home() {
  // TODO: Temporarily bypassing auth redirect for demo
  // const supabase = createClient()
  // const { data: { user } } = await supabase.auth.getUser()
  // if (user) {
  //   redirect('/dashboard')
  // }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Coursify LMS</h1>
          <div className="flex gap-4">
            <Link href="/auth/login" className="px-4 py-2 text-sm font-medium">
              Login
            </Link>
            <Link href="/auth/signup" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium">
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-bold mb-6">
            Update Videos Without Re-recording
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            The only LMS that lets you update 2 minutes of a 30-minute video without re-recording the entire thing.
          </p>
          <div className="flex gap-4 justify-center">
            <Link 
              href="/auth/signup" 
              className="px-8 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700"
            >
              Get Started Free
            </Link>
            <Link 
              href="/auth/login" 
              className="px-8 py-3 border border-gray-300 rounded-md font-medium hover:bg-gray-50"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-24 grid md:grid-cols-3 gap-8">
          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold mb-3">Micro-Video Management</h3>
            <p className="text-gray-600">
              Split videos into segments and update individual sections without re-recording the entire course.
            </p>
          </div>
          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold mb-3">Google Drive Integration</h3>
            <p className="text-gray-600">
              Store your videos in Google Drive and access them directly. No need to upload to our servers.
            </p>
          </div>
          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold mb-3">Progress Tracking</h3>
            <p className="text-gray-600">
              Track learner progress, completion rates, and generate compliance reports with one click.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-gray-600">
          <p>&copy; 2024 Coursify LMS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
