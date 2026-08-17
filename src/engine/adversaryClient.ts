import Anthropic from '@anthropic-ai/sdk'
import OpenAI, { AzureOpenAI } from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { ADVERSARY_OPTIONS_PROMPT, ADVERSARY_NARRATE_PROMPT } from './adversaryPrompt'
import type { ProviderConfig } from '../types/provider'
import type { GameSession } from '../types/game'
import type { AdversaryState, AdversaryTacticOption } from '../types/adversary'
import { ADVERSARY_CLASSES } from '../types/adversary'
import { parseLLMJson } from './llmJson'

export interface AdversaryOptionsResponse {
  options:          AdversaryTacticOption[]
  currentObjective: string
}

export interface AdversaryNarrateResponse {
  attackerNarration:  string
  defenderObservable: string
  complicationsAdded: string[]
}

// ─── Payload builders ─────────────────────────────────────────────────────────

function buildOptionsPayload(session: GameSession, adversary: AdversaryState): string {
  const stages  = session.scenario.killChainStages
  const curIdx  = stages.indexOf(session.attackerProgress[session.attackerProgress.length - 1])
  const nextStage = stages[Math.min(curIdx + 1, stages.length - 1)]

  return JSON.stringify({
    adversaryClass:         adversary.adversaryClass,
    killChainStages:        stages,
    currentStage:           stages[curIdx],
    nextStage,
    defenderComplications:  session.activeComplications,
    stealthScore:           adversary.stealthScore,
    act:                    session.act,
    round:                  session.round,
    scenarioTitle:          session.scenario.title,
    firstActionThisAct:     adversary.firstActionThisAct,
  }, null, 2)
}

function buildNarratePayload(
  session:        GameSession,
  adversary:      AdversaryState,
  actionText:     string,
  roll:           { raw: number; modifier: number; total: number; detectionDC: number; evaded: boolean },
  stageAdvanced:  string | null,
  newStealth:     number,
): string {
  return JSON.stringify({
    adversaryClass:    adversary.adversaryClass,
    actionText,
    roll,
    stageAdvanced,
    stealthScore:      newStealth,
    act:               session.act,
    scenarioTitle:     session.scenario.title,
  }, null, 2)
}

// ─── Response parsers ─────────────────────────────────────────────────────────

function parseOptions(raw: string): AdversaryOptionsResponse {
  const parsed = parseLLMJson<Record<string, any>>(raw, 'adversary options response')
  return {
    options:          parsed.options ?? [],
    currentObjective: parsed.currentObjective ?? '',
  }
}

function parseNarrate(raw: string): AdversaryNarrateResponse {
  const parsed = parseLLMJson<Record<string, any>>(raw, 'adversary narration response')
  return {
    attackerNarration:  parsed.attackerNarration  ?? '',
    defenderObservable: parsed.defenderObservable ?? '',
    complicationsAdded: parsed.complicationsAdded ?? [],
  }
}

// ─── Evasion modifier ─────────────────────────────────────────────────────────

export function getEvasionModifier(adversaryClass: AdversaryState['adversaryClass']): number {
  return ADVERSARY_CLASSES.find((c) => c.id === adversaryClass)?.evasionBonus ?? 2
}

// ─── Provider dispatch: options ───────────────────────────────────────────────

export async function callAdversaryOptions(
  config:   ProviderConfig,
  session:  GameSession,
  adversary: AdversaryState,
): Promise<AdversaryOptionsResponse> {
  const payload = buildOptionsPayload(session, adversary)

  switch (config.provider) {
    case 'anthropic': {
      const client = new Anthropic({ apiKey: config.apiKey, dangerouslyAllowBrowser: true })
      const msg    = await client.messages.create({
        model:      config.model,
        max_tokens: 1024,
        system:     ADVERSARY_OPTIONS_PROMPT,
        messages:   [{ role: 'user', content: payload }],
      })
      const text = msg.content.filter((b) => b.type === 'text').map((b) => (b as { type: 'text'; text: string }).text).join('')
      return parseOptions(text)
    }

    case 'openai': {
      const client = new OpenAI({ apiKey: config.apiKey, dangerouslyAllowBrowser: true })
      const resp   = await client.chat.completions.create({
        model:           config.model,
        max_tokens:      1024,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: ADVERSARY_OPTIONS_PROMPT },
          { role: 'user',   content: payload },
        ],
      })
      return parseOptions(resp.choices[0]?.message?.content ?? '{}')
    }

    case 'azure': {
      const client = new AzureOpenAI({
        apiKey:     config.apiKey,
        endpoint:   config.azureEndpoint!,
        apiVersion: '2024-12-01-preview',
        dangerouslyAllowBrowser: true,
      })
      const resp = await client.chat.completions.create({
        model:           config.model,
        max_tokens:      1024,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: ADVERSARY_OPTIONS_PROMPT },
          { role: 'user',   content: payload },
        ],
      })
      return parseOptions(resp.choices[0]?.message?.content ?? '{}')
    }

    case 'gemini': {
      const genAI = new GoogleGenerativeAI(config.apiKey)
      const model = genAI.getGenerativeModel({
        model:            config.model,
        systemInstruction: ADVERSARY_OPTIONS_PROMPT,
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 1024 },
      })
      const result = await model.generateContent(payload)
      return parseOptions(result.response.text())
    }
  }
}

// ─── Provider dispatch: narrate (streaming) ───────────────────────────────────

export async function callAdversaryNarrate(
  config:        ProviderConfig,
  session:       GameSession,
  adversary:     AdversaryState,
  actionText:    string,
  roll:          { raw: number; modifier: number; total: number; detectionDC: number; evaded: boolean },
  stageAdvanced: string | null,
  newStealth:    number,
  onChunk:       (text: string) => void,
): Promise<AdversaryNarrateResponse> {
  const payload = buildNarratePayload(session, adversary, actionText, roll, stageAdvanced, newStealth)

  switch (config.provider) {
    case 'anthropic': {
      const client  = new Anthropic({ apiKey: config.apiKey, dangerouslyAllowBrowser: true })
      let rawText   = ''
      const stream  = client.messages.stream({
        model:      config.model,
        max_tokens: 1024,
        system:     ADVERSARY_NARRATE_PROMPT,
        messages:   [{ role: 'user', content: payload }],
      })
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          rawText += chunk.delta.text
          onChunk(chunk.delta.text)
        }
      }
      return parseNarrate(rawText)
    }

    case 'openai': {
      const client = new OpenAI({ apiKey: config.apiKey, dangerouslyAllowBrowser: true })
      let rawText  = ''
      const stream = await client.chat.completions.create({
        model:           config.model,
        max_tokens:      1024,
        response_format: { type: 'json_object' },
        stream:          true,
        messages: [
          { role: 'system', content: ADVERSARY_NARRATE_PROMPT },
          { role: 'user',   content: payload },
        ],
      })
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? ''
        if (delta) { rawText += delta; onChunk(delta) }
      }
      return parseNarrate(rawText)
    }

    case 'azure': {
      const client = new AzureOpenAI({
        apiKey:     config.apiKey,
        endpoint:   config.azureEndpoint!,
        apiVersion: '2024-12-01-preview',
        dangerouslyAllowBrowser: true,
      })
      let rawText  = ''
      const stream = await client.chat.completions.create({
        model:           config.model,
        max_tokens:      1024,
        response_format: { type: 'json_object' },
        stream:          true,
        messages: [
          { role: 'system', content: ADVERSARY_NARRATE_PROMPT },
          { role: 'user',   content: payload },
        ],
      })
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? ''
        if (delta) { rawText += delta; onChunk(delta) }
      }
      return parseNarrate(rawText)
    }

    case 'gemini': {
      const genAI = new GoogleGenerativeAI(config.apiKey)
      const model = genAI.getGenerativeModel({
        model:             config.model,
        systemInstruction: ADVERSARY_NARRATE_PROMPT,
        generationConfig:  { responseMimeType: 'application/json', maxOutputTokens: 1024 },
      })
      const result = await model.generateContent(payload)
      const text   = result.response.text()
      onChunk(text)
      return parseNarrate(text)
    }
  }
}
