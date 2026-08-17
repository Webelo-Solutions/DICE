import Anthropic from '@anthropic-ai/sdk'
import OpenAI, { AzureOpenAI } from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { GameSession } from '../types/game'
import type { ActionTriple } from '../utils/actionGrading'
import type { ProviderConfig } from '../types/provider'
import { parseLLMJson } from './llmJson'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActionFeedback {
  actionIndex: number
  techScore:   number   // 1–5: was this the right technique?
  prioScore:   number   // 1–5: was this the right priority right now?
  note:        string   // ≤20 words
}

export interface PlayerAssessment {
  playerName:        string
  overallGrade:      string   // A+, A, B+, B, C+, C, D+, D, F
  overallAssessment: string   // 2–3 sentences
  actionFeedback:    ActionFeedback[]
}

export interface AssessmentResult {
  playerAssessments: PlayerAssessment[]
  teamAssessment:    string
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(session: GameSession, triples: ActionTriple[]): string {
  const participants = session.players
    .map((p) => `${p.name} (${p.class}, Stats: ${JSON.stringify(p.stats)})`)
    .join('\n')

  const actionsText = triples.map((t) => {
    const roll = t.roll?.roll
    const rollLine = roll
      ? `Roll: ${roll.raw} raw + ${roll.modifier} modifier = ${roll.total} vs DC ${roll.dc} → ${roll.outcome.replace(/_/g, ' ').toUpperCase()}`
      : 'No roll recorded'
    const narLine = t.narration
      ? `DM Outcome: "${t.narration.text.slice(0, 200)}${t.narration.text.length > 200 ? '…' : ''}"`
      : ''
    return [
      `[Action ${t.index + 1}]`,
      `Player: ${t.action.speaker}`,
      `Declared: "${t.action.text}"`,
      rollLine,
      narLine,
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  return `You are an expert cybersecurity incident response trainer grading a completed tabletop exercise.

SCENARIO: ${session.scenario.title}
Threat Type: ${session.scenario.threatType}
Difficulty: ${session.scenario.difficulty} / 5
Session Outcome: ${session.status.toUpperCase()}
Victory Condition: ${session.scenario.victoryCondition}
Failure Condition: ${session.scenario.failureCondition}

PARTICIPANTS:
${participants}

PLAYER ACTIONS (${triples.length} total, in order):
${actionsText}

GRADING INSTRUCTIONS:
Evaluate decision quality — not dice luck. A player who declared a brilliant action and rolled a 1 can still get an A for decision quality.

For each action, rate:
- techScore (1–5): Was this the right security technique for the situation?
- prioScore (1–5): Was this the most important thing to do at this moment in the scenario?
- note: One sentence of specific feedback (max 20 words). Reference the actual action.

For each player, give:
- overallGrade: Letter grade A+ through F based on decision quality across all their actions.
- overallAssessment: 2–3 sentences. Be specific. Reference actual decisions. Note both strengths and gaps.

For the team:
- teamAssessment: 1–2 sentences on coordination, coverage, and collective decision quality.

Return ONLY valid JSON — no markdown, no preamble:
{
  "playerAssessments": [
    {
      "playerName": "exact name from feed",
      "overallGrade": "B+",
      "overallAssessment": "...",
      "actionFeedback": [
        { "actionIndex": 0, "techScore": 4, "prioScore": 3, "note": "..." }
      ]
    }
  ],
  "teamAssessment": "..."
}`
}

// ─── API call ─────────────────────────────────────────────────────────────────

export async function callAssessment(
  config:  ProviderConfig,
  session:  GameSession,
  triples:  ActionTriple[],
): Promise<AssessmentResult> {
  if (!config.apiKey) throw new Error('No API key configured.')
  if (triples.length === 0) throw new Error('No player actions to assess.')

  const prompt = buildPrompt(session, triples)
  let raw = ''

  switch (config.provider) {
    case 'anthropic': {
      const client = new Anthropic({ apiKey: config.apiKey, dangerouslyAllowBrowser: true })
      const message = await client.messages.create({
        model:      config.model,
        max_tokens: 8192,
        messages:   [{ role: 'user', content: prompt }],
      })
      if (message.stop_reason === 'max_tokens') {
        throw new Error('Assessment was too long to complete — try ending the session with fewer total actions, or reduce the number of players.')
      }
      raw = message.content.map((block) => block.type === 'text' ? block.text : '').join('')
      break
    }
    case 'openai': {
      const client = new OpenAI({ apiKey: config.apiKey, dangerouslyAllowBrowser: true })
      const res = await client.chat.completions.create({
        model:           config.model,
        max_tokens:      8192,
        response_format: { type: 'json_object' },
        messages:        [{ role: 'user', content: prompt }],
      })
      raw = res.choices[0]?.message?.content ?? ''
      break
    }
    case 'azure': {
      const client = new AzureOpenAI({
        apiKey:     config.apiKey,
        endpoint:   config.azureEndpoint!,
        apiVersion: '2024-12-01-preview',
        dangerouslyAllowBrowser: true,
      })
      const res = await client.chat.completions.create({
        model:           config.azureDeployment ?? config.model,
        max_tokens:      8192,
        response_format: { type: 'json_object' },
        messages:        [{ role: 'user', content: prompt }],
      })
      raw = res.choices[0]?.message?.content ?? ''
      break
    }
    case 'gemini': {
      const genAI = new GoogleGenerativeAI(config.apiKey)
      const model = genAI.getGenerativeModel({
        model: config.model,
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens:  8192,
        },
      })
      const result = await model.generateContent(prompt)
      raw = result.response.text()
      break
    }
  }

  return parseLLMJson<AssessmentResult>(raw, 'assessment response')
}
