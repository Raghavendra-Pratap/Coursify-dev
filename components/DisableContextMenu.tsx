'use client'

import { useEffect } from 'react'

type BrowserDocument = {
  addEventListener: (type: string, listener: EventListener, options?: boolean) => void
  removeEventListener: (type: string, listener: EventListener, options?: boolean) => void
}

function browserDocument(): BrowserDocument | undefined {
  return (globalThis as unknown as { document?: BrowserDocument }).document
}

/**
 * Reduces exposure of video/content sources by:
 * - Disabling the context menu (right-click / Inspect).
 * - Blocking common dev-tool and view-source keyboard shortcuts.
 * Applies to the entire app. Mount once in the root layout.
 * Note: Determined users can still use browser menu or other methods; this discourages casual inspection.
 */
export function DisableContextMenu() {
  useEffect(() => {
    const doc = browserDocument()
    if (!doc) return

    const prevent = (e: Event) => e.preventDefault()
    doc.addEventListener('contextmenu', prevent, true)

    const blockDevToolsShortcuts = (e: Event) => {
      const ev = e as unknown as {
        key?: string
        metaKey?: boolean
        altKey?: boolean
        ctrlKey?: boolean
        shiftKey?: boolean
        preventDefault: () => void
      }
      const nav = (globalThis as unknown as { navigator?: { platform?: string } }).navigator
      const isMac = typeof nav?.platform === 'string' && nav.platform.toLowerCase().includes('mac')
      const mod = isMac ? (ev.metaKey && ev.altKey) : (ev.ctrlKey && ev.shiftKey)
      const key = ev.key?.toLowerCase()

      if (ev.key === 'F12') {
        ev.preventDefault()
        return
      }
      if (mod && (key === 'i' || key === 'j' || key === 'c')) {
        ev.preventDefault()
        return
      }
      if ((isMac ? ev.metaKey && ev.altKey : ev.ctrlKey) && key === 'u') {
        ev.preventDefault()
        return
      }
    }

    doc.addEventListener('keydown', blockDevToolsShortcuts, true)

    return () => {
      doc.removeEventListener('contextmenu', prevent, true)
      doc.removeEventListener('keydown', blockDevToolsShortcuts, true)
    }
  }, [])
  return null
}
