// FIRST: shim crypto.randomUUID on insecure (LAN-IP) origins before any other
// module runs. Keep this above every other import.
import './polyfills/cryptoUUID'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { App } from './App'
import { hydrateFromApi, startApiSync } from './api/sync'
import { startRoomSync } from './api/roomSync'
import { connectRoom } from './api/roomSocket'
import { useRoomStore } from './store/roomStore'
import { apiAuth } from './api/auth'
import { useUserStore } from './store/userStore'

const root = createRoot(document.getElementById('root')!)

function renderApp() {
  root.render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}

function renderError(message: string) {
  root.render(
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0e0a', color: '#e7402c', fontFamily: 'monospace', padding: 24, textAlign: 'center',
    }}>
      <div>
        <div style={{ fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
          Cannot reach DICE server
        </div>
        <div style={{ fontSize: 12, color: '#9aa', maxWidth: 480 }}>{message}</div>
        <div style={{ fontSize: 11, color: '#566', marginTop: 12 }}>
          Start the API with <code>npm run server</code> (or <code>npm run server:dev</code>) and reload.
        </div>
      </div>
    </div>,
  )
}

// Two-stage bootstrap. (1) Determine auth state via /api/auth/me — works without
// a token, returns setupRequired / authenticated. (2) If authenticated, hydrate
// the data stores from the API and start write-through; if not, render anyway —
// App.tsx's RequireAuth layout will route to /setup or /login.
async function bootstrap() {
  const persistedToken = useUserStore.getState().token

  let me
  try {
    me = await apiAuth.me(persistedToken)
  } catch (err) {
    console.error('[startup] /auth/me failed', err)
    renderError(String((err as Error)?.message ?? err))
    return
  }

  useUserStore.setState({
    setupRequired: me.setupRequired,
    user:          me.authenticated ? (me.user ?? null) : null,
    // Drop a stale persisted token if the server doesn't recognize it.
    token:         me.authenticated ? persistedToken : null,
    hydrated:      true,
  })

  if (me.authenticated) {
    try {
      await hydrateFromApi()
    } catch (err) {
      console.error('[startup] hydration failed', err)
      renderError(String((err as Error)?.message ?? err))
      return
    }
    startApiSync()
    startRoomSync()
    // If we left off in a room (persisted membership), reconnect its live channel.
    const membership = useRoomStore.getState().membership
    if (membership) connectRoom(membership.code, membership.token)
  }

  renderApp()
}
bootstrap()
