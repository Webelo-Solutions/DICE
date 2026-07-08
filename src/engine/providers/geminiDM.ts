import { GoogleGenerativeAI } from '@google/generative-ai'
import { DM_SYSTEM_PROMPT } from '../dmPrompt'
import { buildPayload, parseDMResponse, HINT_SYSTEM_PROMPT } from '../dmUtils'
import type { ProviderConfig } from '../../types/provider'
import type { GameSession } from '../../types/game'
import type { DMResponse } from '../../types/dm'
import type { OrgState } from '../../types/orgState'
import type { OrgProfile } from '../../types/orgProfile'

export async function geminiCallDM(
  config:      ProviderConfig,
  session:     GameSession,
  action:      string,
  onChunk:     (text: string) => void,
  orgState?:   OrgState,
  orgProfile?: OrgProfile | null,
): Promise<DMResponse> {
  const genAI = new GoogleGenerativeAI(config.apiKey)
  const model = genAI.getGenerativeModel({
    model:            config.model,
    systemInstruction: DM_SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens:  2048,
    },
  })

  const payload = buildPayload(session, action, orgState, orgProfile)
  let rawText   = ''

  const result = await model.generateContentStream(JSON.stringify(payload, null, 2))
  for await (const chunk of result.stream) {
    const text = chunk.text()
    if (text) { rawText += text; onChunk(text) }
  }

  return parseDMResponse(rawText)
}

export async function geminiCallDMHint(
  config:  ProviderConfig,
  session: GameSession,
  onChunk: (text: string) => void,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(config.apiKey)
  const model = genAI.getGenerativeModel({
    model:             config.model,
    systemInstruction: HINT_SYSTEM_PROMPT,
    generationConfig:  { maxOutputTokens: 200 },
  })

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

  let text   = ''
  const result = await model.generateContentStream(context)
  for await (const chunk of result.stream) {
    const t = chunk.text()
    if (t) { text += t; onChunk(t) }
  }

  return text.trim()
}
