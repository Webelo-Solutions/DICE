import Anthropic from '@anthropic-ai/sdk'
import { DM_SYSTEM_PROMPT } from '../dmPrompt'
import { buildPayload, parseDMResponse, HINT_SYSTEM_PROMPT } from '../dmUtils'
import type { ProviderConfig } from '../../types/provider'
import type { GameSession } from '../../types/game'
import type { DMResponse } from '../../types/dm'
import type { OrgState } from '../../types/orgState'
import type { OrgProfile } from '../../types/orgProfile'

export async function anthropicCallDM(
  config:      ProviderConfig,
  session:     GameSession,
  action:      string,
  onChunk:     (text: string) => void,
  orgState?:   OrgState,
  orgProfile?: OrgProfile | null,
): Promise<DMResponse> {
  const client  = new Anthropic({ apiKey: config.apiKey, dangerouslyAllowBrowser: true })
  const payload = buildPayload(session, action, orgState, orgProfile)
  let rawText   = ''

  const stream = client.messages.stream({
    model:      config.model,
    max_tokens: 2048,
    system:     DM_SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: JSON.stringify(payload, null, 2) }],
  })

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      rawText += chunk.delta.text
      onChunk(chunk.delta.text)
    }
  }

  return parseDMResponse(rawText)
}

export async function anthropicCallDMHint(
  config:  ProviderConfig,
  session: GameSession,
  onChunk: (text: string) => void,
): Promise<string> {
  const client     = new Anthropic({ apiKey: config.apiKey, dangerouslyAllowBrowser: true })
  const currentAct = session.scenario.acts.find((a) => a.number === session.act)

  const context = JSON.stringify({
    scenario:            session.scenario.title,
    act:                 session.act,
    round:               session.round,
    actSeed:             currentAct?.seed ?? '',
    attackerProgress:    session.attackerProgress,
    activeComplications: session.activeComplications,
    availableClues:      currentAct?.clues ?? [],
  })

  let text = ''
  const stream = client.messages.stream({
    model:      config.model,
    max_tokens: 200,
    system:     HINT_SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: context }],
  })

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      text += chunk.delta.text
      onChunk(chunk.delta.text)
    }
  }

  return text.trim()
}
