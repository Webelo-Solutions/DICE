import OpenAI from 'openai'
import { DM_SYSTEM_PROMPT } from '../dmPrompt'
import { buildPayload, parseDMResponse, HINT_SYSTEM_PROMPT } from '../dmUtils'
import type { ProviderConfig } from '../../types/provider'
import type { GameSession } from '../../types/game'
import type { DMResponse } from '../../types/dm'
import type { OrgState } from '../../types/orgState'
import type { OrgProfile } from '../../types/orgProfile'

function makeClient(config: ProviderConfig) {
  return new OpenAI({ apiKey: config.apiKey, dangerouslyAllowBrowser: true })
}

export async function openaiCallDM(
  config:      ProviderConfig,
  session:     GameSession,
  action:      string,
  onChunk:     (text: string) => void,
  orgState?:   OrgState,
  orgProfile?: OrgProfile | null,
): Promise<DMResponse> {
  const client  = makeClient(config)
  const payload = buildPayload(session, action, orgState, orgProfile)
  let rawText   = ''

  const stream = await client.chat.completions.create({
    model:           config.model,
    max_tokens:      2048,
    response_format: { type: 'json_object' },
    stream:          true,
    messages: [
      { role: 'system', content: DM_SYSTEM_PROMPT },
      { role: 'user',   content: JSON.stringify(payload, null, 2) },
    ],
  })

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? ''
    if (delta) { rawText += delta; onChunk(delta) }
  }

  return parseDMResponse(rawText)
}

export async function openaiCallDMHint(
  config:  ProviderConfig,
  session: GameSession,
  onChunk: (text: string) => void,
): Promise<string> {
  const client     = makeClient(config)
  const currentAct = session.scenario.acts.find((a) => a.number === session.act)
  const context    = JSON.stringify({
    scenario:            session.scenario.title,
    act:                 session.act,
    round:               session.round,
    actSeed:             currentAct?.seed ?? '',
    attackerProgress:    session.attackerProgress,
    activeComplications: session.activeComplications,
    availableClues:      currentAct?.clues ?? [],
  })

  let text = ''
  const stream = await client.chat.completions.create({
    model:      config.model,
    max_tokens: 200,
    stream:     true,
    messages: [
      { role: 'system', content: HINT_SYSTEM_PROMPT },
      { role: 'user',   content: context },
    ],
  })

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? ''
    if (delta) { text += delta; onChunk(delta) }
  }

  return text.trim()
}
