export const VERSION_COMPARE_REQUEST_KEY = 'zupfnoter.version-compare.request'
export const VERSION_COMPARE_WINDOW_NAME = 'zupfnoter-version-compare'

export interface VersionCompareRequest {
  path: string
  extract: number
  referenceLabel: string
  comparisonLabel: string
  referenceText: string
  comparisonText: string
}

export function storeVersionCompareRequest(request: VersionCompareRequest): void {
  localStorage.setItem(VERSION_COMPARE_REQUEST_KEY, JSON.stringify(request))
}

export function loadVersionCompareRequest(): VersionCompareRequest | undefined {
  const raw = localStorage.getItem(VERSION_COMPARE_REQUEST_KEY)
  if (raw === null) return undefined
  try {
    const value: unknown = JSON.parse(raw)
    if (!isVersionCompareRequest(value)) return undefined
    return value
  } catch {
    return undefined
  }
}

function isVersionCompareRequest(value: unknown): value is VersionCompareRequest {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.path === 'string'
    && typeof record.extract === 'number'
    && Number.isInteger(record.extract)
    && typeof record.referenceLabel === 'string'
    && typeof record.comparisonLabel === 'string'
    && typeof record.referenceText === 'string'
    && typeof record.comparisonText === 'string'
}
