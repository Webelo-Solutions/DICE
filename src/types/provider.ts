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
    { value: 'claude-sonnet-5',           label: 'Claude Sonnet 5'           },
    { value: 'claude-opus-5',             label: 'Claude Opus 5'             },
    { value: 'claude-fable-5',            label: 'Claude Fable 5'            },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5'          },
    { value: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6'         },
    { value: 'claude-opus-4-7',           label: 'Claude Opus 4.7'           },
  ],
  openai: [
    { value: 'gpt-5.6-sol',   label: 'GPT-5.6 Sol'   },
    { value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
    { value: 'gpt-5.6-luna',  label: 'GPT-5.6 Luna'  },
    { value: 'gpt-4o',        label: 'GPT-4o'        },
    { value: 'gpt-4o-mini',   label: 'GPT-4o Mini'   },
  ],
  azure: [
    { value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
    { value: 'gpt-4o',      label: 'GPT-4o'      },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4',       label: 'GPT-4'       },
  ],
  gemini: [
    { value: 'gemini-3.7-flash',       label: 'Gemini 3.7 Flash'        },
    { value: 'gemini-3.5-flash',       label: 'Gemini 3.5 Flash'        },
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)'},
    { value: 'gemini-2.5-flash',       label: 'Gemini 2.5 Flash'        },
  ],
}

export const DEFAULT_MODEL: Record<AIProvider, string> = {
  anthropic: 'claude-sonnet-5',
  openai:    'gpt-5.6-sol',
  azure:     'gpt-5.6-sol',
  gemini:    'gemini-3.7-flash',
}
