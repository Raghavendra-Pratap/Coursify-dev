import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { DisableContextMenu } from '@/components/DisableContextMenu'

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
    <html lang="en">
      <body>
        <DisableContextMenu />
        {children}
      </body>
    </html>
  )
}
