/**
 * Shown when the page HTML loaded but Next.js client bundles did not (stale dev server).
 * Inline styles only — must work without Tailwind/CSS chunks.
 */
export function DevHydrationHint() {
  return (
    <>
      <div
        id="coursify-hydration-hint"
        style={{
          display: 'none',
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: '#080808',
          color: 'rgba(255,255,255,0.88)',
          fontFamily: 'system-ui, sans-serif',
          padding: '32px 24px',
          boxSizing: 'border-box',
        }}
      >
        <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Coursify could not load</p>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.55)', maxWidth: 480, marginBottom: 20 }}>
          The app shell loaded but JavaScript bundles are missing. This usually happens when the dev server is out of
          sync (often after running <code style={{ color: '#ff6b35' }}>npm run build</code> while{' '}
          <code style={{ color: '#ff6b35' }}>npm run dev</code> is still running).
        </p>
        <p style={{ fontSize: 13, fontFamily: 'ui-monospace, monospace', background: '#161616', padding: 16, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)' }}>
          npm run dev:clean
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 16 }}>
          Then hard-refresh this tab (Cmd+Shift+R).
        </p>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var shown=false;function show(){if(shown)return;shown=true;var el=document.getElementById('coursify-hydration-hint');if(el)el.style.display='block';}window.__coursifyHydrated=false;window.addEventListener('coursify:hydrated',function(){window.__coursifyHydrated=true;});setTimeout(function(){if(window.__coursifyHydrated)return;var s=document.querySelector('script[src*="/_next/static/chunks/main-app"]');if(!s){show();return;}fetch(s.src,{method:'HEAD'}).then(function(r){if(!r.ok)show();}).catch(show);},4500);})();`,
        }}
      />
    </>
  );
}
