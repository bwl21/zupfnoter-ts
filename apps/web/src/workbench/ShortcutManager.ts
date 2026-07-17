export type ShortcutScope = 'global' | 'editor'

export type ShortcutCommand = string | ((event: KeyboardEvent) => string)

export interface ShortcutBinding {
  id: string
  keys: readonly string[]
  command?: ShortcutCommand
  scope: ShortcutScope
  label: string
  help: string
  enabled?: () => boolean
}

export interface ShortcutDispatch {
  (command: string, binding: ShortcutBinding, event: KeyboardEvent): void | Promise<void>
}

export class ShortcutManager {
  private readonly bindings: ShortcutBinding[] = []

  constructor(private readonly dispatch: ShortcutDispatch) {}

  register(binding: ShortcutBinding): void {
    if (binding.id.trim() === '') throw new Error('Shortcut binding id must not be empty')
    if (binding.keys.length === 0) throw new Error(`Shortcut binding has no keys: ${binding.id}`)

    for (const key of binding.keys) {
      const normalizedKey = normalizeShortcutKey(key)
      if (this.bindings.some((existing) => existing.scope === binding.scope && existing.keys.some((candidate) => normalizeShortcutKey(candidate) === normalizedKey))) {
        throw new Error(`Shortcut already registered: ${key} (${binding.scope})`)
      }
    }
    this.bindings.push(binding)
  }

  handle(event: KeyboardEvent): boolean {
    const key = normalizeKeyboardEvent(event)
    if (key === undefined) return false

    const binding = this.find(key).find((candidate) => candidate.enabled?.() !== false)
    if (binding === undefined || binding.command === undefined) return false

    event.preventDefault()
    event.stopPropagation()
    const command = typeof binding.command === 'function'
      ? binding.command(event)
      : binding.command
    void this.dispatch(command, binding, event)
    return true
  }

  find(key: string): ShortcutBinding[] {
    const normalizedKey = normalizeShortcutKey(key)
    return this.bindings.filter((binding) => binding.keys.some((candidate) => normalizeShortcutKey(candidate) === normalizedKey))
  }

  help(filter = ''): ShortcutBinding[] {
    const normalizedFilter = filter.trim().toLocaleLowerCase()
    return this.bindings
      .filter((binding) => normalizedFilter === ''
        || binding.id.toLocaleLowerCase().includes(normalizedFilter)
        || binding.label.toLocaleLowerCase().includes(normalizedFilter)
        || binding.help.toLocaleLowerCase().includes(normalizedFilter)
        || binding.keys.some((key) => key.toLocaleLowerCase().includes(normalizedFilter)))
      .map((binding) => ({ ...binding, keys: [...binding.keys] }))
  }

  format(binding: ShortcutBinding): string {
    const command = typeof binding.command === 'string' ? binding.command : '<dynamisches Kommando>'
    return `${binding.keys.map(formatShortcutKey).join(' / ')} – ${binding.label}: ${binding.help} [${command}]`
  }
}

function normalizeKeyboardEvent(event: KeyboardEvent): string | undefined {
  if (!event.ctrlKey && !event.metaKey) return undefined
  const modifiers = ['Mod']
  if (event.altKey) modifiers.push('Alt')
  if (event.shiftKey) modifiers.push('Shift')
  return normalizeShortcutKey([...modifiers, event.key].join('-'))
}

function normalizeShortcutKey(key: string): string {
  const parts = key.split('-').filter((part) => part !== '')
  const rawKey = parts.pop()?.toUpperCase()
  if (rawKey === undefined) return ''

  const modifiers = new Set(parts.map((part) => {
    const normalized = part.toLowerCase()
    if (normalized === 'ctrl' || normalized === 'control' || normalized === 'cmd' || normalized === 'meta') return 'Mod'
    if (normalized === 'alt' || normalized === 'option') return 'Alt'
    if (normalized === 'shift') return 'Shift'
    return part
  }))
  const orderedModifiers = ['Mod', 'Alt', 'Shift'].filter((modifier) => modifiers.has(modifier))
  return [...orderedModifiers, rawKey].join('-')
}

function formatShortcutKey(key: string): string {
  return normalizeShortcutKey(key).replace('Mod', 'Cmd/Ctrl')
}
