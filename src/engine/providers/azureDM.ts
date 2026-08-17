import { AzureOpenAI } from 'openai'
import { DM_SYSTEM_PROMPT } from '../dmPrompt'
import { buildPayload, parseDMResponse, HINT_SYSTEM_PROMPT } from '../dmUtils'
import type { ProviderConfig } from '../../types/provider'
import type { GameSession } from '../../types/game'
import type { DMResponse } from '../../types/dm'
import type { OrgState } from '../../types/orgState'
import type { OrgProfile } from '../../types/orgProfile'

function makeClient(config: ProviderConfig) {
  return new AzureOpenAI({
    apiKey:      config.apiKey,
    endpoint:    config.azureEndpoint ?? '',
    apiVersion:  '2024-12-01-preview',
    dangerouslyAllowBrowser: true,
  })
}

export async function azureCallDM(
  config:      ProviderConfig,
  session:     GameSession,
  action:      string,
  onChunk:     (text: string) => void,
  orgState?:   OrgState,
  orgProfile?: OrgProfile | null,
): Promise<DMResponse> {
  const client     = makeClient(config)
  const deployment = config.azureDeployment ?? config.model
  const payload    = buildPayload(session, action, orgState, orgProfile)
  let rawText      = ''
  let finishReason: string | null = null

  const stream = await client.chat.completions.create({
    model:           deployment,
    max_tokens:      8192,
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
    if (chunk.choices[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason
  }

  if (finishReason === 'length') {
    throw new Error('The DM\'s response was cut off before it finished (ran out of response length). Try a shorter or more specific action description and try again.')
  }

  return parseDMResponse(rawText)
}

export async function azureCallDMHint(
  config:  ProviderConfig,
  session: GameSession,
  onChunk: (text: string) => void,
): Promise<string> {
  const client     = makeClient(config)
  const deployment = config.azureDeployment ?? config.model
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
    model:      deployment,
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
