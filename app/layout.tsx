import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { DisableContextMenu } from '@/components/DisableContextMenu'
import { AuthProvider } from '@/contexts/AuthContext'
import { DevHydrationHint } from '@/components/DevHydrationHint'

export const metadata: Metadata = {
  title: 'Coursify LMS',
  description: 'Micro-video learning management',
  icons: {
    icon: [{ url: '/brand/coursify-mark.svg', type: 'image/svg+xml' }],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen app-shell">
        <DevHydrationHint />
        <AuthProvider>
        <DisableContextMenu />
        {children}
        </AuthProvider>
      </body>
    </html>
  )
}
