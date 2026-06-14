#!/usr/bin/env node

import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

import { createLegacyCommandStack, type WorkbenchCommandRuntime } from '@zupfnoter/core/legacyCommands'
import type { CommandArgumentValue } from '@zupfnoter/core/commands'

interface CliState {
  abcText: string
  currentExtract: number
  saveFormat: string
  logLevel: string
  autoRefresh: 'on' | 'off' | 'remote'
  settings: Record<string, string>
  localStore: Map<string, string>
}

const state: CliState = {
  abcText: [
    'X:1',
    'T:untitled',
    'M:4/4',
    'L:1/4',
    'K:C',
    'C D E F |]',
    '',
  ].join('\n'),
  currentExtract: 0,
  saveFormat: 'A3-A4',
  logLevel: 'warning',
  autoRefresh: 'on',
  settings: {
    autoscroll: 'true',
    flowconf: 'false',
    follow: 'true',
    validate: 'true',
  },
  localStore: new Map(),
}

function log(message: string): void {
  output.write(`${message}\n`)
}

function renderSummary(): void {
  log(`render requested for extract ${state.currentExtract}, ${state.abcText.length} ABC character(s)`)
}

function extractAbcId(value: string): string {
  const idLine = value.split('\n').find((line) => line.startsWith('X:'))
  const id = idLine?.slice(2).trim()
  return id === undefined || id === '' ? 'untitled' : id
}

const runtime: WorkbenchCommandRuntime = {
  getAbcText: () => state.abcText,
  setAbcText: (value) => {
    state.abcText = value
  },
  render: renderSummary,
  play: (range) => log(`playback is not available in CLI (${range})`),
  stop: () => log('playback stopped'),
  openHarpDuplicate: () => log('view duplicate harp is not available in CLI'),
  openPanelDuplicate: (target) => log(`panel duplicate ${target} is not available in CLI`),
  setSpeed: (speed) => log(`speed=${speed}`),
  setEditorTab: (tab) => log(`tab=${tab}`),
  setCurrentExtract: (extract) => {
    state.currentExtract = Math.trunc(extract)
    log(`extract=${state.currentExtract}`)
  },
  setSaveFormat: (saveFormat) => {
    state.saveFormat = saveFormat
    log(`saveformat=${state.saveFormat}`)
  },
  setLogLevel: (level) => {
    state.logLevel = level
    log(`loglevel=${state.logLevel}`)
  },
  setAutoRefresh: (value) => {
    state.autoRefresh = value
    log(`autorefresh=${state.autoRefresh}`)
  },
  setSetting: (key, value) => {
    state.settings[key] = value
    log(`${key}=${value}`)
  },
  getSetting: (key) => state.settings[key],
  listSettings: () => ({ ...state.settings }),
  downloadAbc: () => log(state.abcText),
  listLocalStore: () => [...state.localStore.keys()].sort(),
  saveLocalStore: () => {
    const id = extractAbcId(state.abcText)
    state.localStore.set(id, state.abcText)
    log(`saved ${id} to CLI local store`)
  },
  openLocalStore: (id) => state.localStore.get(id),
}

export const commandStack = createLegacyCommandStack(runtime, log)

export function handleCommand(command: string): void {
  commandStack.handleCommand(command)
}

export function handleParsedCommand(
  command: string,
  args: Record<string, CommandArgumentValue> = {},
): void {
  commandStack.handleParsedCommand(command, args)
}

async function runRepl(): Promise<void> {
  log('zupfnoter command repl')
  log('type "help" for commands, "exit" to quit')
  const repl = createInterface({ input, output, prompt: 'zupfnoter> ' })
  repl.prompt()

  for await (const line of repl) {
    const command = line.trim()
    if (command === 'exit' || command === 'quit') break
    if (command !== '') {
      try {
        handleCommand(command)
      } catch (error) {
        log(error instanceof Error ? error.message : String(error))
      }
    }
    repl.prompt()
  }

  repl.close()
}

function printUsage(): void {
  log('usage:')
  log('  zupfnoter <sourcepattern> <targetfolder> [config.json]')
  log('  zupfnoter --export-fixtures <sourcepattern> <targetfolder> [config.json]')
  log('  zupfnoter --command "view 2"')
  log('  zupfnoter --repl')
}

function runLegacyBatch(args: string[]): number {
  const fixtureExport = args[0] === '--export-fixtures'
  const batchArgs = fixtureExport ? args.slice(1) : args
  const [sourcepattern, targetfolder, configfile] = batchArgs

  if (sourcepattern === undefined || targetfolder === undefined) {
    printUsage()
    return 1
  }

  log(`processing ${sourcepattern} to ${targetfolder}`)
  if (configfile !== undefined) {
    log(`using config ${configfile}`)
  }
  if (fixtureExport) {
    log('fixture export mode requested')
  }
  log('legacy batch rendering is not ported in this CLI yet')
  return 2
}

async function runCli(args: string[]): Promise<number> {
  if (args.length === 0) {
    await runRepl()
    return 0
  }

  if (args[0] === '--repl') {
    await runRepl()
    return 0
  }

  if (args[0] === '--command' || args[0] === '-c') {
    const command = args.slice(1).join(' ').trim()
    if (command === '') {
      printUsage()
      return 1
    }
    handleCommand(command)
    return 0
  }

  return runLegacyBatch(args)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await runCli(process.argv.slice(2))
}
