export type CommPlatform = 'discord' | 'slack' | 'teams'

export interface CommConfig {
  platform:   CommPlatform
  joinUrl:    string
  webhookUrl: string
}

export const PLATFORM_LABEL: Record<CommPlatform, string> = {
  discord: 'Discord',
  slack:   'Slack',
  teams:   'Microsoft Teams',
}

export const PLATFORM_ICON: Record<CommPlatform, string> = {
  discord: '🎮',
  slack:   '💬',
  teams:   '📋',
}

const MAX_LEN = 1500

function truncate(text: string): string {
  return text.length > MAX_LEN ? text.slice(0, MAX_LEN) + '…' : text
}

function buildPayload(platform: CommPlatform, message: string): object {
  if (platform === 'discord') return { content: truncate(message) }
  if (platform === 'slack')   return { text: truncate(message) }
  return {
    '@type':    'MessageCard',
    '@context': 'https://schema.org/extensions',
    text:       truncate(message),
  }
}

export async function postWebhookEvent(
  config: CommConfig,
  message: string,
): Promise<void> {
  if (!config.webhookUrl.trim()) return
  try {
    await fetch(config.webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(buildPayload(config.platform, message)),
    })
  } catch {
    // Silent — webhook failures must never interrupt gameplay
  }
}

export async function testWebhook(config: CommConfig): Promise<boolean> {
  if (!config.webhookUrl.trim()) return false
  try {
    const res = await fetch(config.webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(buildPayload(
        config.platform,
        `✅ DICE connected — ${PLATFORM_LABEL[config.platform]} webhook is active.`,
      )),
    })
    return res.ok
  } catch {
    return false
  }
}
