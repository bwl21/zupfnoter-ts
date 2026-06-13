import { describe, expect, it } from 'vitest'

import { CommandStack, parseCommandString } from '../commands'
import { registerLegacyCommands, type WorkbenchCommandRuntime } from '../legacyCommands'

function createRuntime(log: string[]): WorkbenchCommandRuntime {
  let abcText = 'X:1\nT:Old\nK:C\nC |]\n'
  const localStore = new Map<string, string>()
  return {
    getAbcText: () => abcText,
    setAbcText: (value) => {
      abcText = value
    },
    render: () => log.push('render'),
    play: (range) => log.push(`play:${range}`),
    stop: () => log.push('stop'),
    setSpeed: (speed) => log.push(`speed:${speed}`),
    setEditorTab: (tab) => log.push(`tab:${tab}`),
    setCurrentExtract: (extract) => log.push(`view:${extract}`),
    setSaveFormat: (saveFormat) => log.push(`saveformat:${saveFormat}`),
    setLogLevel: (level) => log.push(`loglevel:${level}`),
    setAutoRefresh: (value) => log.push(`autorefresh:${value}`),
    setSetting: (key, value) => log.push(`setting:${key}=${value}`),
    getSetting: () => 'false',
    listSettings: () => ({}),
    downloadAbc: () => log.push('download'),
    listLocalStore: () => [...localStore.keys()].sort(),
    saveLocalStore: () => {
      localStore.set('1', abcText)
      log.push('lsave')
    },
    openLocalStore: (id) => localStore.get(id),
  }
}

describe('parseCommandString', () => {
  it('keeps quoted strings and JSON arguments together', () => {
    expect(parseCommandString('c 4711 "Mein Titel"')).toEqual({
      name: 'c',
      values: [4711, 'Mein Titel'],
    })

    expect(parseCommandString('pasteDatauri {"key":"a b","value":[1,2]}')).toEqual({
      name: 'pasteDatauri',
      values: [{ key: 'a b', value: [1, 2] }],
    })
  })
})

describe('legacy command registration', () => {
  it('registers legacy command names in public help', () => {
    const log: string[] = []
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerLegacyCommands(stack, createRuntime(log))

    stack.runString('help dlogin')

    expect(log).toContain('dlogin - dlogin (Dropbox integration is not ported yet)')
  })

  it('executes implemented workbench commands through legacy names', () => {
    const log: string[] = []
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerLegacyCommands(stack, createRuntime(log))

    stack.runString('view 2')
    stack.runString('p auto')
    stack.runString('speed 0.5')
    stack.runString('saveformat A4')
    stack.runString('editconf layout')

    expect(log).toEqual([
      'view:2',
      'render',
      'play:auto',
      'speed:0.5',
      'saveformat:A4',
      'tab:config',
    ])
  })

  it('supports undo for create and local open commands', () => {
    const log: string[] = []
    const runtime = createRuntime(log)
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerLegacyCommands(stack, runtime)

    stack.runString('c 2 "New Song"')
    expect(runtime.getAbcText()).toContain('T:New Song')

    stack.runString('undo')
    expect(runtime.getAbcText()).toContain('T:Old')
  })
})
