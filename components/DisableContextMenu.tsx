'use client'

import { useEffect } from 'react'

/**
 * Disables the browser context menu (right-click) for the entire app.
 * Mount once in the root layout.
 */
export function DisableContextMenu() {
  useEffect(() => {
    const prevent = (e: MouseEvent) => e.preventDefault()
    document.addEventListener('contextmenu', prevent)
    return () => document.removeEventListener('contextmenu', prevent)
  }, [])
  return null
}
