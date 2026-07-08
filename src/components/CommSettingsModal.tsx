import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import {
  PLATFORM_LABEL,
  testWebhook,
} from '../engine/webhookClient'
import type { CommPlatform } from '../engine/webhookClient'

const PLATFORMS: CommPlatform[] = ['discord', 'slack', 'teams']

const JOIN_PLACEHOLDER: Record<CommPlatform, string> = {
  discord: 'https://discord.gg/your-invite',
  slack:   'https://your-workspace.slack.com/channels/...',
  teams:   'https://teams.microsoft.com/l/meetup-join/...',
}

const WEBHOOK_PLACEHOLDER: Record<CommPlatform, string> = {
  discord: 'https://discord.com/api/webhooks/...',
  slack:   'https://hooks.slack.com/services/...',
  teams:   'https://outlook.office.com/webhook/...',
}

const PLATFORM_COLOR: Record<CommPlatform, string> = {
  discord: 'border-indigo-500/60 bg-indigo-500/15 text-indigo-300',
  slack:   'border-purple-500/60 bg-purple-500/15 text-purple-300',
  teams:   'border-blue-500/60   bg-blue-500/15   text-blue-300',
}

const PLATFORM_IDLE: Record<CommPlatform, string> = {
  discord: 'border-indigo-500/25 bg-indigo-500/5 text-indigo-300/60 hover:border-indigo-500/50 hover:bg-indigo-500/10',
  slack:   'border-purple-500/25 bg-purple-500/5 text-purple-300/60 hover:border-purple-500/50 hover:bg-purple-500/10',
  teams:   'border-blue-500/25   bg-blue-500/5   text-blue-300/60   hover:border-blue-500/50   hover:bg-blue-500/10',
}

interface Props {
  onClose: () => void
}

export function CommSettingsModal({ onClose }: Props) {
  const { commConfig, setCommConfig } = useGameStore()

  const [platform,    setPlatform]    = useState<CommPlatform>(commConfig?.platform ?? 'discord')
  const [joinUrl,     setJoinUrl]     = useState(commConfig?.joinUrl     ?? '')
  const [webhookUrl,  setWebhookUrl]  = useState(commConfig?.webhookUrl  ?? '')
  const [testState,   setTestState]   = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  const hasJoin    = joinUrl.trim().length > 0
  const hasWebhook = webhookUrl.trim().length > 0
  const hasAny     = hasJoin || hasWebhook

  function handleSave() {
    if (!hasAny) {
      setCommConfig(null)
    } else {
      setCommConfig({ platform, joinUrl: joinUrl.trim(), webhookUrl: webhookUrl.trim() })
    }
    onClose()
  }

  function handleClear() {
    setCommConfig(null)
    setJoinUrl('')
    setWebhookUrl('')
    setTestState('idle')
  }

  async function handleTest() {
    if (!hasWebhook) return
    setTestState('testing')
    const ok = await testWebhook({ platform, joinUrl, webhookUrl })
    setTestState(ok ? 'ok' : 'fail')
    setTimeout(() => setTestState('idle'), 3000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-md mx-4 bg-terminal-bg border border-terminal-border rounded-lg
          shadow-2xl font-mono overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-terminal-border
          bg-terminal-surface">
          <div>
            <div className="text-xs font-bold text-white tracking-widest uppercase">Comms Configuration</div>
            <div className="text-[10px] text-terminal-dim mt-0.5">
              Connect your team's communication platform
            </div>
          </div>
          <button onClick={onClose} className="text-terminal-dim hover:text-white text-sm transition-colors">✕</button>
        </div>

        <div className="p-5 space-y-5">

          {/* Platform picker */}
          <div>
            <div className="text-[10px] text-terminal-dim tracking-widest uppercase mb-2">Platform</div>
            <div className="flex gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => { setPlatform(p); setTestState('idle') }}
                  className={`flex-1 py-2 rounded border text-xs font-semibold tracking-wide transition-all ${
                    platform === p ? PLATFORM_COLOR[p] : PLATFORM_IDLE[p]
                  }`}
                >
                  {PLATFORM_LABEL[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Join URL */}
          <div>
            <div className="text-[10px] text-terminal-dim tracking-widest uppercase mb-1.5">
              Join Link <span className="normal-case opacity-60">(opens in new tab for players)</span>
            </div>
            <input
              type="url"
              value={joinUrl}
              onChange={(e) => setJoinUrl(e.target.value)}
              placeholder={JOIN_PLACEHOLDER[platform]}
              className="w-full bg-terminal-surface border border-terminal-border rounded px-3 py-2
                text-xs text-gray-300 font-mono placeholder-terminal-dim/40
                focus:outline-none focus:border-terminal-green/50"
            />
          </div>

          {/* Webhook URL */}
          <div>
            <div className="text-[10px] text-terminal-dim tracking-widest uppercase mb-1.5">
              Incoming Webhook <span className="normal-case opacity-60">(posts game events to channel)</span>
            </div>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder={WEBHOOK_PLACEHOLDER[platform]}
              className="w-full bg-terminal-surface border border-terminal-border rounded px-3 py-2
                text-xs text-gray-300 font-mono placeholder-terminal-dim/40
                focus:outline-none focus:border-terminal-green/50"
            />
            {/* Test button */}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleTest}
                disabled={!hasWebhook || testState === 'testing'}
                className="px-3 py-1 rounded border border-terminal-border text-[10px] text-terminal-dim
                  hover:border-terminal-green/40 hover:text-terminal-green disabled:opacity-30
                  disabled:cursor-not-allowed transition-all"
              >
                {testState === 'testing' ? 'Sending…' : 'Send Test Message'}
              </button>
              <AnimatePresence mode="wait">
                {testState === 'ok' && (
                  <motion.span
                    key="ok"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[10px] text-terminal-green"
                  >
                    ✓ Delivered
                  </motion.span>
                )}
                {testState === 'fail' && (
                  <motion.span
                    key="fail"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[10px] text-terminal-red"
                  >
                    ✕ Failed — check URL
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Events note */}
          <div className="rounded border border-terminal-border bg-terminal-surface/60 px-3 py-2.5">
            <div className="text-[10px] text-terminal-dim tracking-widest uppercase mb-1">
              Events posted to webhook
            </div>
            <div className="text-[10px] text-terminal-dim/70 space-y-0.5">
              <div>🎲 Dice rolls with outcome tier</div>
              <div>📖 DM narrations</div>
              <div>⚡ Facilitator injects</div>
              <div>📋 Facilitator notes</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-terminal-border
          bg-terminal-surface">
          <button
            onClick={handleClear}
            className="px-3 py-1.5 rounded border border-terminal-border text-terminal-dim
              text-[10px] hover:border-terminal-red/40 hover:text-terminal-red transition-all"
          >
            Clear Config
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-terminal-border text-terminal-dim
                text-xs hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded border border-terminal-green/50 bg-terminal-green/10
                text-terminal-green text-xs font-semibold tracking-widest uppercase
                hover:bg-terminal-green/20 transition-all"
            >
              Save
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
