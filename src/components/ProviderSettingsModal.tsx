import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import type { AIProvider, ProviderConfig } from '../types/provider'
import { PROVIDER_LABEL, PROVIDER_GLYPH, PROVIDER_MODELS, DEFAULT_MODEL } from '../types/provider'

interface Props {
  onClose: () => void
}

const PROVIDERS: AIProvider[] = ['anthropic', 'openai', 'azure', 'gemini']

export function ProviderSettingsModal({ onClose }: Props) {
  const { providerConfig, setProviderConfig } = useGameStore()

  const [provider,    setProvider]    = useState<AIProvider>(providerConfig?.provider ?? 'anthropic')
  const [apiKey,      setApiKey]      = useState(providerConfig?.provider === (providerConfig?.provider ?? 'anthropic') ? (providerConfig?.apiKey ?? '') : '')
  const [model,       setModel]       = useState(providerConfig?.model ?? DEFAULT_MODEL['anthropic'])
  const [azureEndpt,  setAzureEndpt]  = useState(providerConfig?.azureEndpoint   ?? '')
  const [azureDeploy, setAzureDeploy] = useState(providerConfig?.azureDeployment ?? '')

  const switchProvider = (p: AIProvider) => {
    setProvider(p)
    setModel(DEFAULT_MODEL[p])
    // Restore saved values for this provider if it matches current config
    if (providerConfig?.provider === p) {
      setApiKey(providerConfig.apiKey)
      setModel(providerConfig.model)
      setAzureEndpt(providerConfig.azureEndpoint ?? '')
      setAzureDeploy(providerConfig.azureDeployment ?? '')
    } else {
      setApiKey('')
      setAzureEndpt('')
      setAzureDeploy('')
    }
  }

  const canSave = (() => {
    if (!apiKey.trim()) return false
    if (provider === 'azure' && (!azureEndpt.trim() || !azureDeploy.trim())) return false
    return true
  })()

  const handleSave = () => {
    if (!canSave) return
    const cfg: ProviderConfig = {
      provider,
      apiKey:   apiKey.trim(),
      model,
      ...(provider === 'azure' ? {
        azureEndpoint:   azureEndpt.trim(),
        azureDeployment: azureDeploy.trim(),
      } : {}),
    }
    setProviderConfig(cfg)
    onClose()
  }

  const models = PROVIDER_MODELS[provider]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 16 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{    scale: 0.95, opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="w-full max-w-md bg-terminal-surface border border-terminal-border
          rounded-xl shadow-2xl font-mono overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-terminal-border">
          <div>
            <div className="text-[10px] text-terminal-dim tracking-widest uppercase mb-0.5">Configure</div>
            <div className="text-sm font-bold text-white tracking-wide">AI Dungeon Master</div>
          </div>
          <button
            onClick={onClose}
            className="text-terminal-dim/50 hover:text-terminal-dim text-lg transition-colors leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Provider selector */}
          <div>
            <div className="text-[9px] text-terminal-dim tracking-widest uppercase mb-2">Provider</div>
            <div className="grid grid-cols-2 gap-1.5">
              {PROVIDERS.map((p) => (
                <button
                  key={p}
                  onClick={() => switchProvider(p)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded border text-left
                    transition-all duration-150 text-xs ${
                    provider === p
                      ? 'border-terminal-green bg-terminal-green/10 text-terminal-green'
                      : 'border-terminal-border bg-terminal-bg text-terminal-dim hover:border-terminal-dim hover:text-gray-300'
                  }`}
                >
                  <span className="text-base leading-none flex-shrink-0">{PROVIDER_GLYPH[p]}</span>
                  <span className="font-semibold">{PROVIDER_LABEL[p]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* API key */}
          <div>
            <div className="text-[9px] text-terminal-dim tracking-widest uppercase mb-1.5">
              {provider === 'azure' ? 'Azure API Key' : 'API Key'}
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                provider === 'anthropic' ? 'sk-ant-api03-...' :
                provider === 'openai'    ? 'sk-...'           :
                provider === 'azure'     ? 'Azure API key'    :
                                           'AI...'
              }
              autoComplete="off"
              className="w-full bg-terminal-bg border border-terminal-border focus:border-terminal-green
                text-white text-xs px-3 py-2.5 rounded focus:outline-none placeholder-terminal-dim/50
                tracking-widest transition-colors"
            />
          </div>

          {/* Azure-specific fields */}
          <AnimatePresence>
            {provider === 'azure' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-3 overflow-hidden"
              >
                <div>
                  <div className="text-[9px] text-terminal-dim tracking-widest uppercase mb-1.5">Endpoint URL</div>
                  <input
                    type="text"
                    value={azureEndpt}
                    onChange={(e) => setAzureEndpt(e.target.value)}
                    placeholder="https://myresource.openai.azure.com"
                    autoComplete="off"
                    className="w-full bg-terminal-bg border border-terminal-border focus:border-terminal-green
                      text-white text-xs px-3 py-2.5 rounded focus:outline-none placeholder-terminal-dim/50
                      transition-colors"
                  />
                </div>
                <div>
                  <div className="text-[9px] text-terminal-dim tracking-widest uppercase mb-1.5">Deployment Name</div>
                  <input
                    type="text"
                    value={azureDeploy}
                    onChange={(e) => setAzureDeploy(e.target.value)}
                    placeholder="my-gpt4o-deployment"
                    autoComplete="off"
                    className="w-full bg-terminal-bg border border-terminal-border focus:border-terminal-green
                      text-white text-xs px-3 py-2.5 rounded focus:outline-none placeholder-terminal-dim/50
                      transition-colors"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Model selector — not shown for Azure (uses deployment name) */}
          {provider !== 'azure' && (
            <div>
              <div className="text-[9px] text-terminal-dim tracking-widest uppercase mb-1.5">Model</div>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-terminal-bg border border-terminal-border focus:border-terminal-green
                  text-white text-xs px-3 py-2.5 rounded focus:outline-none transition-colors appearance-none"
              >
                {models.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Privacy note */}
          <p className="text-[10px] text-terminal-dim/60 leading-relaxed">
            API keys are stored in browser localStorage only. They are sent exclusively to the selected
            provider's API — never logged or transmitted elsewhere.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full py-2.5 rounded border border-terminal-green bg-terminal-green/10
              text-terminal-green text-xs font-bold tracking-widest uppercase
              hover:bg-terminal-green/20 disabled:opacity-30 disabled:cursor-not-allowed
              transition-all duration-150"
          >
            Save Configuration
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
