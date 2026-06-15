import { describe, expect, it } from 'vitest'

import {
  CommandStack,
  parseCommandString,
  registerLegacyCommands,
  type WorkbenchCommandRuntime,
} from '@zupfnoter/core'

function createRuntime(log: string[]): WorkbenchCommandRuntime {
  let abcText = [
    'X:1',
    'F:old_file',
    'T:Old',
    'K:C',
    'C |]',
    '',
    '%%%%zupfnoter.config',
    '',
    '{"extract":{"0":{"title":"Old","voices":[1]},"1":{"title":"Second"}}}',
    '',
  ].join('\n')
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
    openHarpDuplicate: () => log.push('duplicate:harp'),
    openPanelDuplicate: (target: string) => log.push(`duplicate:${target}`),
    setSound: (sound) => log.push(`sound:${sound}`),
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
    stack.runString('panel duplicate harp')
    stack.runString('panel duplicate notes')
    stack.runString('sound piano')
    stack.runString('p auto')
    stack.runString('speed 0.5')
    stack.runString('saveformat A4')
    stack.runString('editconf layout')

    expect(log).toEqual([
      'view:2',
      'render',
      'duplicate:harp',
      'duplicate:notes',
      'sound:piano',
      'play:auto',
      'speed:0.5',
      'saveformat:A4',
      'tab:config',
    ])
  })

  it('documents panel duplicate targets in help', () => {
    const log: string[] = []
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerLegacyCommands(stack, createRuntime(log))

    stack.runString('help panel')

    expect(log).toContain('panel <action> <target> - duplicate a panel into a second window (harp | notes)')
    expect(log).toContain('panel duplicate harp - duplicate the harp panel into a second window')
    expect(log).toContain('panel duplicate notes - duplicate the notes panel into a second window')
  })

  it('suggests unique command completions and typo candidates', () => {
    const log: string[] = []
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerLegacyCommands(stack, createRuntime(log))

    expect(stack.suggest('p')).toEqual({
      completed: 'p',
      didYouMean: [],
    })

    expect(stack.suggest('dlogi')).toEqual({
      completed: 'dlogin',
      didYouMean: [],
    })

    expect(stack.suggest('dlofin')).toEqual({
      completed: 'dlofin',
      didYouMean: expect.arrayContaining(['dlogin']),
    })
  })

  it('switches playback sound through the legacy command', () => {
    const log: string[] = []
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerLegacyCommands(stack, createRuntime(log))

    stack.runString('sound harfe')
    stack.runString('sound klavier')
    stack.runString('sound grandPiano')
    stack.runString('sound western-gitarre')

    expect(log).toContain('sound:harfe')
    expect(log).toContain('sound:klavier')
    expect(log).toContain('sound:grandPiano')
    expect(log).toContain('sound:western-gitarre')
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

  it('patches and reverts embedded config values', () => {
    const log: string[] = []
    const runtime = createRuntime(log)
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerLegacyCommands(stack, runtime)

    stack.runString('cconf extract.0.title NeuerTitel')
    expect(runtime.getAbcText()).toContain('"title": "NeuerTitel"')

    stack.runString('delconfig extract.0.title')
    expect(runtime.getAbcText()).not.toContain('"title": "NeuerTitel"')

    stack.runString('undoconfig')
    expect(runtime.getAbcText()).toContain('"title": "NeuerTitel"')

    stack.runString('redoconfig')
    expect(runtime.getAbcText()).not.toContain('"title": "NeuerTitel"')
  })

  it('copies config values between extracts', () => {
    const log: string[] = []
    const runtime = createRuntime(log)
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerLegacyCommands(stack, runtime)

    stack.runString('cpconfig extract.0.voices 2')

    expect(runtime.getAbcText()).toContain('"2": {')
    expect(runtime.getAbcText()).toContain('"voices": [')
  })

  it('stores standard config snippets and applies them through legacy commands', () => {
    const log: string[] = []
    const runtime = createRuntime(log)
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerLegacyCommands(stack, runtime)

    stack.runString('setstdnotes')
    stack.runString('cconf extract.0.title Changed')
    stack.runString('stdnotes')

    expect(runtime.getAbcText()).toContain('"title": "Old"')
  })

  it('creates and edits templates', () => {
    const log: string[] = []
    const runtime = createRuntime(log)
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerLegacyCommands(stack, runtime)

    stack.runString('maketemplate')

    expect(runtime.getAbcText()).toContain('X:{{song_id}}')
    expect(runtime.getAbcText()).toContain('F:{{song_id}}_{{filename}}')
    expect(runtime.getAbcText()).toContain('T:{{song_title}}')
  })
})
