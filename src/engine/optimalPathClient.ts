import Anthropic from '@anthropic-ai/sdk'
import OpenAI, { AzureOpenAI } from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { GameSession } from '../types/game'
import type { ActionTriple } from '../utils/actionGrading'
import type { ProviderConfig } from '../types/provider'
import { parseLLMJson } from './llmJson'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OptimalAction {
  label:     string   // short action title (e.g. "Isolate patient-zero host")
  rationale: string   // 1 sentence: why this beats alternatives at this moment
  archetype?: string  // optional: which class is best positioned for this
}

export interface ActOptimalPath {
  actNumber:         number
  primaryObjective:  string                   // echoed for context
  recommendedActions: OptimalAction[]         // 3–5 ordered steps for this act
  keyMisses:         string[]                 // paragraph each: what was missed, why it mattered, and the transferable lesson
}

export interface OptimalPathResult {
  summary:    string                           // 2–3 sentences on the overall arc
  acts:       ActOptimalPath[]
  caveats:    string                           // 1 sentence on why multiple valid paths exist
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(session: GameSession, triples: ActionTriple[]): string {
  const sc = session.scenario

  const actsText = sc.acts.map((act) => {
    const clueLines = act.clues
      .map((c, i) => {
        const tech = c.techniqueId ? ` [${c.techniqueId} ${c.techniqueName ?? ''}]` : ''
        return `  - Clue ${i + 1}: ${c.text}${tech}`
      })
      .join('\n')
    const boss = act.bossEvent ? `\nBoss Event: ${act.bossEvent}` : ''
    return `## ACT ${act.number}
Primary Objective: ${act.primaryObjective}
Scene Seed: ${act.seed}${boss}
Available Clues:
${clueLines || '  (none)'}`
  }).join('\n\n')

  const participants = session.players
    .map((p) => `${p.name} (${p.class})`)
    .join(', ')

  const actualActions = triples.map((t, i) => {
    const outcome = t.roll?.roll?.outcome?.replace(/_/g, ' ') ?? 'no roll'
    return `${i + 1}. [${t.action.speaker}] "${t.action.text}" — ${outcome}`
  }).join('\n')

  return `You are a senior incident response trainer producing a post-exercise study guide. Your job: describe the highest-leverage path through this scenario, then compare it to what the team actually did.

SCENARIO: ${sc.title}
Threat Type: ${sc.threatType}
Difficulty: ${sc.difficulty} / 5
Victory Condition: ${sc.victoryCondition}
Failure Condition: ${sc.failureCondition}
Kill Chain Stages: ${sc.killChainStages.join(' → ')}

PARTICIPANTS: ${participants}

ACT STRUCTURE:
${actsText}

WHAT THE TEAM ACTUALLY DID (${triples.length} actions, in order):
${actualActions}

INSTRUCTIONS:
1. For each act, produce 3–5 ordered "optimal" actions a strong IR team would take. Anchor them to the act's clues and primary objective. Each \`label\` should be a short verb phrase. Each \`rationale\` should be ONE sentence explaining why this action beats alternatives at this point in the timeline.
2. For each act, list 1–4 \`keyMisses\` — specific things the team failed to do (or did too late) that would have made a measurable difference. Write EACH key miss as a full instructional paragraph of at least 4 sentences (never a single sentence — this section is the primary learning artifact after the exercise). In each paragraph: (a) name concretely what the team missed or did too late, anchored to this act's clues and to what they actually did; (b) state the correct action and the moment it should have happened; (c) explain the measurable consequence their omission created in THIS scenario — what the attacker gained, what evidence was lost, or how much time/blast-radius it cost; and (d) close with the transferable lesson, phrased so the team recognizes and handles the same situation in a real incident. Be concrete and scenario-specific, not generic.
3. Where one archetype is clearly best-positioned for an action (e.g., Engineer for automation, Hunter for proactive search), set \`archetype\`. Omit it when any role could execute.
4. Write a 2–3 sentence \`summary\` describing the optimal arc of the response — what the ideal team would prioritize and in what order.
5. Write a 1 sentence \`caveats\` line acknowledging that real IR has multiple valid paths and this is one defensible expert opinion.

Return ONLY valid JSON — no markdown, no preamble:
{
  "summary": "...",
  "acts": [
    {
      "actNumber": 1,
      "primaryObjective": "echo the act's primary objective verbatim",
      "recommendedActions": [
        { "label": "Triage the alert", "rationale": "...", "archetype": "Analyst" }
      ],
      "keyMisses": ["a full multi-sentence instructional paragraph: what was missed, the correct action and its timing, the concrete consequence in this scenario, and the transferable lesson"]
    }
  ],
  "caveats": "..."
}`
}

// ─── API call ─────────────────────────────────────────────────────────────────

export async function callOptimalPath(
  config:  ProviderConfig,
  session: GameSession,
  triples: ActionTriple[],
): Promise<OptimalPathResult> {
  if (!config.apiKey) throw new Error('No API key configured.')
  if (triples.length === 0) throw new Error('No player actions to analyze.')

  const prompt = buildPrompt(session, triples)
  let raw = ''

  switch (config.provider) {
    case 'anthropic': {
      const client = new Anthropic({ apiKey: config.apiKey, dangerouslyAllowBrowser: true })
      const message = await client.messages.create({
        model:      config.model,
        max_tokens: 16000,
        messages:   [{ role: 'user', content: prompt }],
      })
      if (message.stop_reason === 'max_tokens') {
        throw new Error('Optimal path response was too long to complete — try ending the session with fewer total actions or acts, or reduce the number of players.')
      }
      raw = message.content.map((block) => block.type === 'text' ? block.text : '').join('')
      break
    }
    case 'openai': {
      const client = new OpenAI({ apiKey: config.apiKey, dangerouslyAllowBrowser: true })
      const res = await client.chat.completions.create({
        model:           config.model,
        max_tokens:      16000,
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
        max_tokens:      16000,
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
          maxOutputTokens:  16000,
        },
      })
      const result = await model.generateContent(prompt)
      raw = result.response.text()
      break
    }
  }

  return parseLLMJson<OptimalPathResult>(raw, 'optimal path response')
}
