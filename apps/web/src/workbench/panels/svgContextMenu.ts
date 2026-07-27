import type { CommandArgumentValue } from '@zupfnoter/core'
import type { MoreConfKey } from '@zupfnoter/types'

export type SvgContextMenuAction = 'edit' | 'set' | 'reset-shape' | 'delete-shape' | 'separator'

export interface SvgContextMenuEntry {
  text: string
  icon?: string
  action: SvgContextMenuAction
  path?: string
  /** Parameterpfad für Hilfe, wenn die Aktion einen übergeordneten Editor öffnet. */
  helpPath?: string
  value?: CommandArgumentValue
  disabled: boolean
}

export function buildSvgContextMenuEntries(
  confKey: string | null,
  moreConfKeys: MoreConfKey[],
  options: {
    visibilityPath?: string
    resetShapePath?: string
    resetShapeValue?: CommandArgumentValue
    deleteShapePath?: string
  } = {},
): SvgContextMenuEntry[] {
  const entries: SvgContextMenuEntry[] = []
  const normalizedConfKey = confKey?.trim() ?? ''
  if (normalizedConfKey.length > 0) {
    entries.push({
      text: 'Konfiguration bearbeiten',
      icon: 'fa fa-gear',
      action: 'edit',
      path: stripLeaf(normalizedConfKey),
      helpPath: normalizedConfKey,
      disabled: false,
    })
  }

  const visibilityPath = options.visibilityPath?.trim() ?? ''
  if (visibilityPath.length > 0) {
    entries.push({
      text: 'Sichtbarkeit bearbeiten',
      icon: '◉',
      action: 'edit',
      path: stripLeaf(visibilityPath),
      helpPath: visibilityPath,
      disabled: false,
    })
  }

  const resetShapePath = options.resetShapePath?.trim() ?? ''
  if (resetShapePath.length > 0 && options.resetShapeValue !== undefined) {
    entries.push({
      text: 'Formung zurücksetzen',
      icon: 'fa fa-refresh',
      action: 'reset-shape',
      path: resetShapePath,
      value: options.resetShapeValue,
      disabled: false,
    })
  }

  const deleteShapePath = options.deleteShapePath?.trim() ?? ''
  if (deleteShapePath.length > 0) {
    entries.push({
      text: 'Formung löschen',
      icon: 'fa fa-trash',
      action: 'delete-shape',
      path: deleteShapePath,
      disabled: false,
    })
  }

  for (const entry of moreConfKeys) {
    const path = entry.conf_key?.trim()
    const text = entry.text ?? ''
    const value = entry.value
    if (path === undefined || path.length === 0) {
      entries.push({
        text,
        ...(entry.icon === undefined ? {} : { icon: entry.icon }),
        action: 'separator',
        disabled: true,
      })
      continue
    }

    if (value !== undefined && isCommandArgumentValue(value)) {
      entries.push({
        text,
        ...(entry.icon === undefined ? {} : { icon: entry.icon }),
        action: 'set',
        path,
        value,
        disabled: false,
      })
      continue
    }

    const editPath = path.endsWith('.minc_f') ? path : stripLeaf(path)
    entries.push({
      text,
      ...(entry.icon === undefined ? {} : { icon: entry.icon }),
      action: 'edit',
      path: editPath,
      helpPath: path,
      disabled: value !== undefined,
    })
  }

  return entries
}

export function parseSvgContextMenuEntries(serialized: string | null): MoreConfKey[] {
  if (serialized === null || serialized.trim() === '') return []
  try {
    const parsed: unknown = JSON.parse(serialized)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isMoreConfKey)
  } catch {
    return []
  }
}

function isMoreConfKey(value: unknown): value is MoreConfKey {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return (candidate.text === undefined || typeof candidate.text === 'string')
    && (candidate.conf_key === undefined || typeof candidate.conf_key === 'string')
    && (candidate.icon === undefined || typeof candidate.icon === 'string')
}

function isCommandArgumentValue(value: unknown): value is CommandArgumentValue {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.every(isCommandArgumentValue)
  if (typeof value !== 'object') return false
  return Object.values(value).every(isCommandArgumentValue)
}

function stripLeaf(path: string): string {
  return path.replace(/\.[^.]+$/, '')
}
