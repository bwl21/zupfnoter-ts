import { describe, expect, it } from 'vitest'

import {
  CommandStack,
  parseCommandString,
  registerLegacyCommands,
  registerStorageCommands,
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
    getSound: () => 'piano',
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
    readDocument: () => abcText,
    writeDocument: (value: string) => {
      abcText = value
    },
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
  it('lists public help entries in alphabetical order', async () => {
    const log: string[] = []
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerLegacyCommands(stack, createRuntime(log))

    await stack.runString('help')

    expect(log).toEqual([...log].sort((left, right) => left.localeCompare(right)))
  })

  it('registers legacy command names in public help', async () => {
    const log: string[] = []
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerLegacyCommands(stack, createRuntime(log))

    await stack.runString('help dlogin')

    expect(log).toContain('dlogin - dlogin (Dropbox integration is not ported yet)')
  })

  it('executes implemented workbench commands through legacy names', async () => {
    const log: string[] = []
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerLegacyCommands(stack, createRuntime(log))

    await stack.runString('view 2')
    await stack.runString('panel duplicate harp')
    await stack.runString('panel duplicate notes')
    await stack.runString('sound piano')
    await stack.runString('p auto')
    await stack.runString('speed 0.5')
    await stack.runString('saveformat A4')
    await stack.runString('editconf layout')

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

  it('documents panel duplicate targets in help', async () => {
    const log: string[] = []
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerLegacyCommands(stack, createRuntime(log))

    await stack.runString('help panel')

    expect(log.some((line) => line.startsWith('panel <action> <target> - duplicate a panel into a second window'))).toBe(true)
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

  it('switches playback sound through the legacy command', async () => {
    const log: string[] = []
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerLegacyCommands(stack, createRuntime(log))

    await stack.runString('sound harfe')
    await stack.runString('sound klavier')
    await stack.runString('sound grandPiano')
    await stack.runString('sound western-gitarre')

    expect(log).toContain('sound:harfe')
    expect(log).toContain('sound:klavier')
    expect(log).toContain('sound:grandPiano')
    expect(log).toContain('sound:western-gitarre')
  })

  it('shows the current sound when sound is called without arguments', async () => {
    const log: string[] = []
    const runtime = createRuntime(log)
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerLegacyCommands(stack, runtime)

    await stack.runString('sound')

    expect(log).toContain('sound piano')
  })

  it('supports undo for create and local open commands', async () => {
    const log: string[] = []
    const runtime = createRuntime(log)
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerLegacyCommands(stack, runtime)

    await stack.runString('c 2 "New Song"')
    expect(runtime.getAbcText()).toContain('T:New Song')

    await stack.runString('undo')
    expect(runtime.getAbcText()).toContain('T:Old')
  })

  it('supports undo for storage open commands', async () => {
    const log: string[] = []
    const runtime = createRuntime(log)
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerStorageCommands(stack, {
      system: 'dropbox',
      path: '',
      loggedIn: true,
      pendingCandidates: [],
    }, {
      providers: ['dropbox'],
      list: async () => ['first.abc', 'second.abc'],
      search: async (_path, query) => query === 'first' ? ['first.abc'] : ['second.abc'],
      open: async (_path, filename) => `${filename}\n`,
      save: async () => undefined,
      readDocument: () => runtime.getAbcText(),
      writeDocument: (value) => runtime.setAbcText(value),
      login: async () => undefined,
      logout: async () => undefined,
      cleanup: async () => undefined,
    })

    runtime.setAbcText('original\n')
    await stack.runString('sopen first')
    expect(runtime.getAbcText()).toBe('first.abc\n')

    await stack.runString('undo')
    expect(runtime.getAbcText()).toBe('original\n')
  })

  it('supports undo for selected storage candidates', async () => {
    let documentText = 'start\n'
    const log: string[] = []
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerStorageCommands(stack, {
      system: 'dropbox',
      path: '',
      loggedIn: true,
      pendingCandidates: [],
    }, {
      providers: ['dropbox'],
      list: async () => ['alpha.abc', 'beta.abc'],
      search: async () => ['alpha.abc', 'beta.abc'],
      open: async (_path, filename) => `${filename}\n`,
      save: async () => undefined,
      readDocument: () => documentText,
      writeDocument: (value: string) => {
        documentText = value
      },
      login: async () => undefined,
      logout: async () => undefined,
      cleanup: async () => undefined,
    })

    await stack.runString('sopen a')
    await stack.runString('sopen 1')
    expect(documentText).toBe('alpha.abc\n')

    await stack.runString('undo')
    expect(documentText).toBe('start\n')
  })

  it('keeps recursive storage listings in hierarchical path order', async () => {
    const log: string[] = []
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerStorageCommands(stack, {
      system: 'dropbox',
      path: '',
      loggedIn: true,
      pendingCandidates: [],
    }, {
      providers: ['dropbox'],
      list: async () => ['b/song.abc', 'a/song.abc'],
      search: async (_path, query) => query === 'abend'
        ? ['a/song.abc', 'a/sub/song.abc', 'b/song.abc']
        : ['a/song.abc', 'a/sub/song.abc', 'b/song.abc'],
      open: async () => undefined,
      save: async () => undefined,
      readDocument: () => '',
      writeDocument: () => undefined,
      login: async () => undefined,
      logout: async () => undefined,
      cleanup: async () => undefined,
    })

    await stack.runString('sls -r abend')

    expect(log).toEqual([
      'a/song.abc',
      'a/sub/song.abc',
      'b/song.abc',
    ])
  })

  it('treats the first storage parameter as recursive flag or search string', async () => {
    const log: string[] = []
    const stack = new CommandStack({ log: (message) => log.push(message) })
    const listCalls: boolean[] = []
    registerStorageCommands(stack, {
      system: 'dropbox',
      path: '',
      loggedIn: true,
      pendingCandidates: [],
    }, {
      providers: ['dropbox'],
      list: async (_path, recursive) => {
        listCalls.push(Boolean(recursive))
        return ['root/a.abc']
      },
      search: async (_path, query) => {
        listCalls.push(query === 'foo')
        return ['root/a.abc', 'root/sub/b.abc']
      },
      open: async (_path, filename) => `${filename}\n`,
      save: async () => undefined,
      readDocument: () => '',
      writeDocument: () => undefined,
      login: async () => undefined,
      logout: async () => undefined,
      cleanup: async () => undefined,
    })

    await stack.runString('sls foo')
    await stack.runString('sls -r foo')

    expect(listCalls).toEqual([false, true])
    expect(log).toContain('root/a.abc')
  })

  it('treats sopen the same way as sls for recursive flag parsing', async () => {
    const log: string[] = []
    const stack = new CommandStack({ log: (message) => log.push(message) })
    const listCalls: boolean[] = []
    registerStorageCommands(stack, {
      system: 'dropbox',
      path: '',
      loggedIn: true,
      pendingCandidates: [],
    }, {
      providers: ['dropbox'],
      list: async (_path, recursive) => {
        listCalls.push(Boolean(recursive))
        return ['root/a.abc']
      },
      search: async (_path, query) => {
        listCalls.push(query === 'a')
        return ['root/a.abc', 'root/sub/b.abc']
      },
      open: async (_path, filename) => `${filename}\n`,
      save: async () => undefined,
      readDocument: () => '',
      writeDocument: () => undefined,
      login: async () => undefined,
      logout: async () => undefined,
      cleanup: async () => undefined,
    })

    await stack.runString('sopen -r a')

    expect(listCalls).toEqual([true])
    expect(log).toContain('multiple matches for "a" (use sopen <n>):')
  })

  it('normalizes scd / to the storage root for recursive listing', async () => {
    const log: string[] = []
    const stack = new CommandStack({ log: (message) => log.push(message) })
    const paths: string[] = []
    registerStorageCommands(stack, {
      system: 'dropbox',
      path: 'nested/path',
      loggedIn: true,
      pendingCandidates: [],
    }, {
      providers: ['dropbox'],
      list: async (state, recursive) => {
        paths.push(`${state.path}:${recursive ? 'r' : 'n'}`)
        return ['abend/a.abc']
      },
      search: async (state, query) => {
        paths.push(`${state.path}:search:${query}`)
        return ['abend/a.abc', 'foo/sub/abend-b.abc']
      },
      open: async () => undefined,
      save: async () => undefined,
      readDocument: () => '',
      writeDocument: () => undefined,
      login: async () => undefined,
      logout: async () => undefined,
      cleanup: async () => undefined,
    })

    await stack.runString('scd /')
    await stack.runString('sls -r Abend')

    expect(paths).toContain(':search:Abend')
    expect(log).toEqual([
      'abend/a.abc',
      'foo/sub/abend-b.abc',
    ])
  })

  it('patches and reverts embedded config values', async () => {
    const log: string[] = []
    const runtime = createRuntime(log)
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerLegacyCommands(stack, runtime)

    await stack.runString('cconf extract.0.title NeuerTitel')
    expect(runtime.getAbcText()).toContain('"title": "NeuerTitel"')

    await stack.runString('delconfig extract.0.title')
    expect(runtime.getAbcText()).not.toContain('"title": "NeuerTitel"')

    await stack.runString('undoconfig')
    expect(runtime.getAbcText()).toContain('"title": "NeuerTitel"')

    await stack.runString('redoconfig')
    expect(runtime.getAbcText()).not.toContain('"title": "NeuerTitel"')
  })

  it('copies config values between extracts', async () => {
    const log: string[] = []
    const runtime = createRuntime(log)
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerLegacyCommands(stack, runtime)

    await stack.runString('cpconfig extract.0.voices 2')

    expect(runtime.getAbcText()).toContain('"2": {')
    expect(runtime.getAbcText()).toContain('"voices": [')
  })

  it('stores standard config snippets and applies them through legacy commands', async () => {
    const log: string[] = []
    const runtime = createRuntime(log)
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerLegacyCommands(stack, runtime)

    await stack.runString('setstdnotes')
    await stack.runString('cconf extract.0.title Changed')
    await stack.runString('stdnotes')

    expect(runtime.getAbcText()).toContain('"title": "Old"')
  })

  it('creates and edits templates', async () => {
    const log: string[] = []
    const runtime = createRuntime(log)
    const stack = new CommandStack({ log: (message) => log.push(message) })
    registerLegacyCommands(stack, runtime)

    await stack.runString('maketemplate')

    expect(runtime.getAbcText()).toContain('X:{{song_id}}')
    expect(runtime.getAbcText()).toContain('F:{{song_id}}_{{filename}}')
    expect(runtime.getAbcText()).toContain('T:{{song_title}}')
  })
})
