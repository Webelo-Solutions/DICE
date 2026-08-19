import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { Landing }          from './pages/Landing'
import { ScenarioSelect }   from './pages/ScenarioSelect'
import { RosterPage }       from './pages/RosterPage'
import { CharacterCreate }  from './pages/CharacterCreate'
import { GameSession }      from './pages/GameSession'
import { SessionEnd }       from './pages/SessionEnd'
import { HotWash }          from './pages/HotWash'
import { CampaignBuilder }  from './pages/CampaignBuilder'
import { ContentPacks }     from './pages/ContentPacks'
import { Analytics }        from './pages/Analytics'
import { CpeLedger }        from './pages/CpeLedger'
import { AdversarySetup }   from './pages/AdversarySetup'
import { HostGame }         from './pages/HostGame'
import { JoinGame }         from './pages/JoinGame'
import { Lobby }            from './pages/Lobby'
import { RoomPlayer }       from './pages/RoomPlayer'
import { SpectatorView }    from './pages/SpectatorView'
import { Setup }            from './pages/Setup'
import { Login }            from './pages/Login'
import { Register }         from './pages/Register'
import { AdminUsers }       from './pages/AdminUsers'
import { AdminAnalytics }   from './pages/AdminAnalytics'
import { AdminInjectsCatalog } from './pages/AdminInjectsCatalog'
import { AdminScenarios }   from './pages/AdminScenarios'
import { Account }          from './pages/Account'
import { RoomAutoNav }      from './components/RoomAutoNav'
import { AppShell }         from './components/AppShell'
import { useGameStore }     from './store/gameStore'
import { useUserStore }     from './store/userStore'
import type { ScenarioPack } from './types/game'

// Layout route that gates the entire app behind auth. If first-run setup isn't
// done yet, route to /setup; if no user is signed in, route to /login. Renders
// the persistent AppShell (sidebar nav + command palette + toasts) whenever a
// user IS signed in.
function RequireAuth() {
  const setupRequired = useUserStore((s) => s.setupRequired)
  const user          = useUserStore((s) => s.user)
  if (setupRequired) return <Navigate to="/setup" replace />
  if (!user)         return <Navigate to="/login" replace />
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

// Layered on top of RequireAuth — also enforces role=admin. Renders inside
// the auth layout so the AppShell sidebar stays visible.
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const user = useUserStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireSession({ children }: { children: React.ReactNode }) {
  const session = useGameStore((s) => s.session)
  if (!session || session.status === 'setup') return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireResult({ children }: { children: React.ReactNode }) {
  const result = useGameStore((s) => s.result)
  if (!result) return <Navigate to="/" replace />
  return <>{children}</>
}

export function App() {
  const setScenario = (scenario: ScenarioPack) => {
    useGameStore.setState((s) => ({
      session: {
        id:                     'pending',
        scenario,
        players:                s.session?.status === 'setup' ? (s.session.players ?? []) : [],
        mode:                   'solo',
        initiativeOrder:        [],
        currentTurnPlayerId:    '',
        act:                    1,
        round:                  1,
        scenarioClockRemaining: scenario.scenarioClockStart,
        attackerProgress:       [scenario.killChainStages[0]],
        activeComplications:    [],
        lastRoll:               null,
        roundTimerExpired:      false,
        activeEffects:          [],
        scriptedCriticalEffect: null,
        critHitInjectsDrawn:    [],
        critFailInjectsDrawn:   [],
        // Placeholders — real resolution happens at the initSession call in
        // RosterPage/AdversarySetup, once the catalog store has been fetched.
        resolvedCriticalHitInjects:  [],
        resolvedCriticalFailInjects: [],
        phase:                  'init',
        status:                 'setup',
        timerDifficulty:        'analyst',
        startedAt:              0,
        npcs:                   [],
        usedOnceTraits:         {},
      },
      activeOrgProfile: null,  // ad-hoc launch — no org profile context
    }))
  }

  return (
    <MotionConfig reducedMotion="user">
    <RoomAutoNav />
    <Routes>
      {/* Unprotected — visible without a session */}
      <Route path="/setup" element={<Setup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/watch/:code" element={<SpectatorView />} />

      {/* Everything else is gated by RequireAuth (auth + setupRequired checks) */}
      <Route element={<RequireAuth />}>
        <Route path="/"          element={<Landing />} />
        <Route path="/scenarios" element={<ScenarioSelect onSelect={setScenario} />} />
        <Route path="/roster"    element={<RosterPage />} />
        <Route path="/create"    element={<CharacterCreate />} />
        <Route path="/game"      element={<RequireSession><GameSession /></RequireSession>} />
        <Route path="/end"       element={<RequireResult><SessionEnd /></RequireResult>} />
        <Route path="/report"    element={<RequireResult><HotWash /></RequireResult>} />
        <Route path="/adversary" element={<AdversarySetup />} />
        <Route path="/host"      element={<HostGame />} />
        <Route path="/join"      element={<JoinGame />} />
        <Route path="/lobby"     element={<Lobby />} />
        <Route path="/play"      element={<RoomPlayer />} />
        <Route path="/campaigns" element={<CampaignBuilder />} />
        <Route path="/content-packs" element={<ContentPacks />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/cpe"       element={<CpeLedger />} />
        <Route path="/account"     element={<Account />} />
        <Route path="/admin/users" element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
        <Route path="/admin/analytics" element={<RequireAdmin><AdminAnalytics /></RequireAdmin>} />
        <Route path="/admin/injects-catalog" element={<RequireAdmin><AdminInjectsCatalog /></RequireAdmin>} />
        <Route path="/admin/scenarios" element={<RequireAdmin><AdminScenarios /></RequireAdmin>} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </MotionConfig>
  )
}
