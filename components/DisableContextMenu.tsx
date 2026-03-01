'use client'

import { useEffect } from 'react'

/**
 * Reduces exposure of video/content sources by:
 * - Disabling the context menu (right-click / Inspect).
 * - Blocking common dev-tool and view-source keyboard shortcuts.
 * Applies to the entire app. Mount once in the root layout.
 * Note: Determined users can still use browser menu or other methods; this discourages casual inspection.
 */
export function DisableContextMenu() {
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault()
    document.addEventListener('contextmenu', prevent, true)

    const blockDevToolsShortcuts = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('mac')
      const mod = isMac ? (e.metaKey && e.altKey) : (e.ctrlKey && e.shiftKey)
      const key = e.key?.toLowerCase()

      if (e.key === 'F12') {
        e.preventDefault()
        return
      }
      if (mod && (key === 'i' || key === 'j' || key === 'c')) {
        e.preventDefault()
        return
      }
      if ((isMac ? e.metaKey && e.altKey : e.ctrlKey) && key === 'u') {
        e.preventDefault()
        return
      }
    }

    document.addEventListener('keydown', blockDevToolsShortcuts, true)

    return () => {
      document.removeEventListener('contextmenu', prevent, true)
      document.removeEventListener('keydown', blockDevToolsShortcuts, true)
    }
  }, [])
  return null
}
