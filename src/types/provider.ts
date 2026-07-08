export type AIProvider = 'anthropic' | 'openai' | 'azure' | 'gemini'

export interface ProviderConfig {
  provider:         AIProvider
  apiKey:           string
  model:            string
  azureEndpoint?:   string   // e.g. https://myresource.openai.azure.com
  azureDeployment?: string   // deployment name used instead of model name
}

export const PROVIDER_LABEL: Record<AIProvider, string> = {
  anthropic: 'Anthropic',
  openai:    'OpenAI',
  azure:     'Microsoft Azure',
  gemini:    'Google Gemini',
}

export const PROVIDER_GLYPH: Record<AIProvider, string> = {
  anthropic: '◈',
  openai:    '◎',
  azure:     '⬡',
  gemini:    '✦',
}

export const PROVIDER_MODELS: Record<AIProvider, { value: string; label: string }[]> = {
  anthropic: [
    { value: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6'         },
    { value: 'claude-opus-4-7',           label: 'Claude Opus 4.7'           },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5'          },
  ],
  openai: [
    { value: 'gpt-4o',      label: 'GPT-4o'        },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini'   },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo'   },
    { value: 'o1',          label: 'o1'             },
  ],
  azure: [
    { value: 'gpt-4o',      label: 'GPT-4o'        },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini'   },
    { value: 'gpt-4',       label: 'GPT-4'         },
  ],
  gemini: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro',   label: 'Gemini 1.5 Pro'   },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
}

export const DEFAULT_MODEL: Record<AIProvider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai:    'gpt-4o',
  azure:     'gpt-4o',
  gemini:    'gemini-2.0-flash',
}
