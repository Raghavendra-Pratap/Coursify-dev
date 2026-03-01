import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { DisableContextMenu } from '@/components/DisableContextMenu'
import { AuthProvider } from '@/contexts/AuthContext'

export const metadata: Metadata = {
  title: 'Coursify LMS',
  description: 'Learning Management System with micro-video management',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-900 text-gray-100 min-h-screen">
        <AuthProvider>
        <DisableContextMenu />
        {children}
        </AuthProvider>
      </body>
    </html>
  )
}
