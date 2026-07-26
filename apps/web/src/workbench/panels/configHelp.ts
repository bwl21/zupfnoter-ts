export type ConfigHelpTexts = Record<string, string>

const DEFAULT_LOCALE = 'de-de'

export async function loadConfigHelpTexts(locale = DEFAULT_LOCALE): Promise<ConfigHelpTexts> {
  const primary = await tryLoadConfigHelpTexts(locale)
  if (primary !== undefined) return primary

  if (locale !== DEFAULT_LOCALE) {
    const fallback = await tryLoadConfigHelpTexts(DEFAULT_LOCALE)
    if (fallback !== undefined) return fallback
  }

  return {}
}

async function tryLoadConfigHelpTexts(locale: string): Promise<ConfigHelpTexts | undefined> {
  const response = await fetch(`/locale/conf-help_${locale}.json`, { cache: 'no-cache' }).catch(() => undefined)
  if (response === undefined || !response.ok) return undefined
  const parsed = await response.json().catch(() => undefined)
  return isRecord(parsed) ? convertConfigHelpTexts(parsed) : undefined
}

function convertConfigHelpTexts(source: Record<string, unknown>): ConfigHelpTexts {
  const result: ConfigHelpTexts = {}

  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string') {
      // The generated documentation escapes underscores in JSON keys. SVG
      // config paths use the unescaped parameter names.
      result[key.replace(/\\_/g, '_')] = value
    }
  }

  return result
}

export function resolveConfigHelpHtml(key: string, helpTexts: ConfigHelpTexts): string | undefined {
  for (const candidate of getConfigHelpCandidateKeys(key)) {
    const help = helpTexts[candidate]
    if (typeof help === 'string' && help !== '') return help
  }

  return undefined
}

export function getConfigHelpCandidateKeys(key: string): string[] {
  let helpKey = key
  helpKey = helpKey.replace(/^(extract\.)(\d+)(.*)$/, '$10$3')
  helpKey = helpKey.replace(/^(extract\.0\.lyrics\.)(\d+)(.*)$/, '$10$3')
  helpKey = helpKey.replace(/^(extract\.0\.images\.)(\d+)(.*)$/, '$10$3')
  helpKey = helpKey.replace(/^(extract\.0\.notes\.)([a-zA-SU-Z_0-9]+)(.*)$/, '$10$3')
  helpKey = helpKey.replace(/^(extract\.0\.tuplet\.)([a-zA-SU-Z_0-9]+)(.*)$/, '$10$3')

  const parts = helpKey.split('.')
  return parts.map((_, index) => parts.slice(index).join('.'))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
