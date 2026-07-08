import type { ProviderConfig } from '../types/provider'
import type { GameSession } from '../types/game'
import type { DMResponse } from '../types/dm'
import type { OrgState } from '../types/orgState'
import type { OrgProfile } from '../types/orgProfile'
import { anthropicCallDM, anthropicCallDMHint } from './providers/anthropicDM'
import { openaiCallDM,    openaiCallDMHint    } from './providers/openaiDM'
import { azureCallDM,     azureCallDMHint     } from './providers/azureDM'
import { geminiCallDM,    geminiCallDMHint    } from './providers/geminiDM'

export async function callDM(
  config:     ProviderConfig,
  session:    GameSession,
  action:     string,
  onChunk:    (text: string) => void,
  orgState?:  OrgState,
  orgProfile?: OrgProfile | null,
): Promise<DMResponse> {
  switch (config.provider) {
    case 'anthropic': return anthropicCallDM(config, session, action, onChunk, orgState, orgProfile)
    case 'openai':    return openaiCallDM(config, session, action, onChunk, orgState, orgProfile)
    case 'azure':     return azureCallDM(config, session, action, onChunk, orgState, orgProfile)
    case 'gemini':    return geminiCallDM(config, session, action, onChunk, orgState, orgProfile)
  }
}

export async function callDMHint(
  config:  ProviderConfig,
  session: GameSession,
  onChunk: (text: string) => void,
): Promise<string> {
  switch (config.provider) {
    case 'anthropic': return anthropicCallDMHint(config, session, onChunk)
    case 'openai':    return openaiCallDMHint(config, session, onChunk)
    case 'azure':     return azureCallDMHint(config, session, onChunk)
    case 'gemini':    return geminiCallDMHint(config, session, onChunk)
  }
}
