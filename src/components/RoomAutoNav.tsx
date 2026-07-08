import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { useRoomStore } from '../store/roomStore'

// Routes a room PLAYER automatically: into their player view when the
// facilitator starts the session, and back to the lobby when it ends. The
// facilitator drives their own navigation, so they're left alone.
export function RoomAutoNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const membership = useRoomStore((s) => s.membership)
  const sessionStatus = useGameStore((s) => s.session?.status ?? null)

  useEffect(() => {
    if (!membership || membership.role !== 'player') return
    const onRoomPage = location.pathname === '/lobby' || location.pathname === '/play'
    if (!onRoomPage) return   // don't yank players who navigated elsewhere on purpose

    if (sessionStatus === 'active' && location.pathname !== '/play') {
      navigate('/play')
    } else if (sessionStatus !== 'active' && location.pathname === '/play') {
      navigate('/lobby')
    }
  }, [membership, sessionStatus, location.pathname, navigate])

  return null
}
