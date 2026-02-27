'use client'

import { useEffect } from 'react'

/**
 * Disables the browser context menu (right-click) for the entire app.
 * Applies to both learner and instructor views. Mount once in the root layout.
 */
export function DisableContextMenu() {
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault()
    document.addEventListener('contextmenu', prevent, true)
    return () => document.removeEventListener('contextmenu', prevent, true)
  }, [])
  return null
}
