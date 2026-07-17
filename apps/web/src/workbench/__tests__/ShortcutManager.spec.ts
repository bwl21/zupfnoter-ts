import { describe, expect, it, vi } from 'vitest'

import { ShortcutManager } from '../ShortcutManager'

function keyboardEvent(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', { ...init, cancelable: true })
}

describe('ShortcutManager', () => {
  it('normalizes Cmd and Ctrl to Mod and dispatches the command', () => {
    const dispatch = vi.fn()
    const manager = new ShortcutManager(dispatch)
    manager.register({ id: 'save', keys: ['Mod-S'], command: 'ssave', scope: 'global', label: 'Speichern', help: 'Dokument speichern' })

    const event = keyboardEvent({ key: 's', ctrlKey: true })
    expect(manager.handle(event)).toBe(true)
    expect(event.defaultPrevented).toBe(true)
    expect(dispatch).toHaveBeenCalledWith('ssave', expect.objectContaining({ id: 'save' }), event)
  })

  it('supports dynamic commands and disabled bindings', () => {
    const dispatch = vi.fn()
    const manager = new ShortcutManager(dispatch)
    manager.register({ id: 'view', keys: ['Mod-0', 'Mod-1'], command: (event) => `view ${event.key}`, scope: 'global', label: 'Auszug', help: 'Auszug wechseln' })
    manager.register({ id: 'disabled', keys: ['Mod-D'], command: 'disabled', scope: 'global', label: 'Deaktiviert', help: 'Nicht aktiv', enabled: () => false })

    expect(manager.handle(keyboardEvent({ key: '1', metaKey: true }))).toBe(true)
    expect(dispatch).toHaveBeenCalledWith('view 1', expect.anything(), expect.anything())
    expect(manager.handle(keyboardEvent({ key: 'd', metaKey: true }))).toBe(false)
  })

  it('formats filtered help and rejects duplicate bindings', () => {
    const manager = new ShortcutManager(vi.fn())
    manager.register({ id: 'save', keys: ['Mod-S'], command: 'ssave', scope: 'global', label: 'Speichern', help: 'Dokument speichern' })

    expect(manager.help('speichern').map((binding) => manager.format(binding))).toEqual([
      'Cmd/Ctrl-S – Speichern: Dokument speichern [ssave]',
    ])
    expect(() => manager.register({ id: 'other', keys: ['Ctrl-S'], command: 'other', scope: 'global', label: 'Andere', help: 'Andere Aktion' })).toThrow('Shortcut already registered')
  })

  it('ignores shortcuts without a modifier', () => {
    const dispatch = vi.fn()
    const manager = new ShortcutManager(dispatch)
    manager.register({ id: 'save', keys: ['Mod-S'], command: 'ssave', scope: 'global', label: 'Speichern', help: 'Dokument speichern' })

    expect(manager.handle(keyboardEvent({ key: 's' }))).toBe(false)
    expect(dispatch).not.toHaveBeenCalled()
  })
})
