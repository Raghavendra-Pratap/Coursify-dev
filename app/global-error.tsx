'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isChunkError =
    error?.name === 'ChunkLoadError' ||
    (typeof error?.message === 'string' && error.message.includes('Loading chunk'))

  const handleRetry = () => {
    if (isChunkError) {
      window.location.reload()
    } else {
      reset()
    }
  }

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#111', color: '#eee', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '420px' }}>
          <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Something went wrong</h1>
          <p style={{ color: '#888', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {isChunkError
              ? 'The app failed to load. This can happen after an update or a slow connection.'
              : error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
            }}
          >
            {isChunkError ? 'Reload page' : 'Try again'}
          </button>
        </div>
      </body>
    </html>
  )
}
