#!/usr/bin/env node

import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { readFile, writeFile } from 'node:fs/promises'
import { deflateRaw, inflateRaw } from 'node:zlib'
import { promisify } from 'node:util'

import { createLegacyCommandStack, type WorkbenchCommandRuntime } from '@zupfnoter/core/legacyCommands'
import type { CommandArgumentValue } from '@zupfnoter/core/commands'
import { exportPlaybackLink, type PlaybackCompressionCodec, type PlaybackEvent } from '@zupfnoter/playback'

const deflateRawAsync = promisify(deflateRaw)
const inflateRawAsync = promisify(inflateRaw)

const nodePlaybackCodec: PlaybackCompressionCodec = {
  async compress(value) {
    return new Uint8Array(await deflateRawAsync(Buffer.from(value)))
  },
  async decompress(value) {
    return new Uint8Array(await inflateRawAsync(Buffer.from(value)))
  },
}

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
  readDocument: () => state.abcText,
  writeDocument: (content) => {
    state.abcText = content
  },
  getCurrentExtract: () => state.currentExtract,
  getSound: () => 'cli-default',
  render: renderSummary,
  play: (range) => log(`playback is not available in CLI (${range})`),
  stop: () => log('playback stopped'),
  openHarpDuplicate: () => log('view duplicate harp is not available in CLI'),
  openPanelDuplicate: (target) => log(`panel duplicate ${target} is not available in CLI`),
  setSpeed: (speed) => log(`speed=${speed}`),
  setEditorTab: (tab) => log(`tab=${tab}`),
  setConfigEditorSection: (section) => log(`config=${section}`),
  setCurrentExtract: (extract) => {
    state.currentExtract = Math.trunc(extract)
    log(`extract=${state.currentExtract}`)
  },
  setSound: (sound) => log(`sound=${sound}`),
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
  log('  zupfnoter playback-link --events timeline.json --player-url https://play.zupfnoter.de/')
}

function parseOption(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index < 0 ? undefined : args[index + 1]
}

function isPlaybackEvent(value: unknown): value is PlaybackEvent {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const position = record.position
  if (typeof position !== 'object' || position === null) return false
  const positionRecord = position as Record<string, unknown>
  return typeof record.startMs === 'number'
    && typeof record.durationMs === 'number'
    && typeof record.pitch === 'number'
    && typeof positionRecord.measureNumber === 'number'
    && typeof positionRecord.passIndex === 'number'
}

async function runPlaybackLink(args: string[]): Promise<number> {
  const eventsFile = parseOption(args, '--events')
  const playerUrl = parseOption(args, '--player-url')
  if (eventsFile === undefined || playerUrl === undefined) {
    printUsage()
    return 1
  }

  const parsed: unknown = JSON.parse(await readFile(eventsFile, 'utf8'))
  if (!Array.isArray(parsed) || !parsed.every(isPlaybackEvent)) {
    throw new Error('timeline.json muss ein Array von Playback-Ereignissen enthalten')
  }
  const result = await exportPlaybackLink(parsed, { playerUrl }, nodePlaybackCodec)
  const outputFile = parseOption(args, '--output')
  if (outputFile === undefined) {
    log(result.url)
  } else {
    await writeFile(outputFile, `${result.url}\n`, 'utf8')
    log(`playback link written to ${outputFile}`)
  }
  return 0
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

  if (args[0] === 'playback-link') {
    return runPlaybackLink(args.slice(1))
  }

  return runLegacyBatch(args)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await runCli(process.argv.slice(2))
}
