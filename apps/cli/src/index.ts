#!/usr/bin/env node

import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { deflateRaw, inflateRaw } from 'node:zlib'
import { promisify } from 'node:util'

import { createLegacyCommandStack, type WorkbenchCommandRuntime } from '@zupfnoter/core/legacyCommands'
import type { CommandArgumentValue } from '@zupfnoter/core/commands'
import {
  AbcParser,
  AbcToSong,
  Confstack,
  HarpnotesLayout,
  PdfEngine,
  SvgEngine,
  PLAYER_QR_IMAGE_NAME,
  buildPlaybackExportData,
  createPlayerQrJpeg,
  extractSongConfig,
  extractSongFilebase,
  extractSongResources,
  initConf,
  mergeSongConfig,
  pdfOutputFilename,
  replaceSongDocumentResources,
} from '@zupfnoter/core'
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

function setCliResource(key: string, value: string): void {
  const parts = Array.from({ length: Math.ceil(value.length / 60) }, (_entry, index) => value.slice(index * 60, (index + 1) * 60))
  state.abcText = replaceSongDocumentResources(state.abcText, { ...extractSongResources(state.abcText), [key]: parts })
}

function deleteCliResource(key: string): void {
  const resources = { ...extractSongResources(state.abcText) }
  delete resources[key]
  state.abcText = replaceSongDocumentResources(state.abcText, resources)
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
  setResource: setCliResource,
  deleteResource: deleteCliResource,
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
  log('  zupfnoter <sourcepattern> <targetfolder> [config.json] [--player-url <url>] [--format A3|A4|A3-A4]')
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

function globToRegExp(pattern: string): RegExp {
  let source = '^'
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]
    if (character === '*') {
      if (pattern[index + 1] === '*') {
        source += '.*'
        index += 1
      } else {
        source += '[^/]*'
      }
    } else if (character === '?') {
      source += '[^/]'
    } else {
      source += character?.replace(/[.+^${}()|[\]\\]/g, '\\$&') ?? ''
    }
  }
  return new RegExp(`${source}$`)
}

async function expandSourcePattern(sourcePattern: string): Promise<string[]> {
  const absolutePattern = resolve(sourcePattern)
  const wildcardIndex = absolutePattern.search(/[?*[]/)
  if (wildcardIndex < 0) {
    const fileInfo = await stat(absolutePattern).catch(() => undefined)
    return fileInfo?.isFile() ? [absolutePattern] : []
  }

  const prefix = absolutePattern.slice(0, wildcardIndex)
  const root = dirname(prefix.endsWith('/') ? prefix.slice(0, -1) : prefix)
  const matcher = globToRegExp(relative(root, absolutePattern))
  const matches: string[] = []

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(entryPath)
      } else if (entry.isFile() && matcher.test(relative(root, entryPath))) {
        matches.push(entryPath)
      }
    }
  }

  await visit(root)
  return matches.sort()
}

function dataUrlFromJpeg(bytes: Uint8Array): string {
  return `data:image/jpeg;base64,${Buffer.from(bytes).toString('base64')}`
}

function resolveBatchExtracts(config: ReturnType<typeof mergeSongConfig>): number[] {
  const extracts = config.produce !== undefined && config.produce.length > 0 ? config.produce : [0]
  return [...new Set(extracts)]
}

function extractFilenamePart(config: ReturnType<typeof mergeSongConfig>, extractNr: number): string {
  const extract = config.extract[String(extractNr)]
  return extract?.filenamepart?.trim() || extract?.title?.trim() || String(extractNr)
}

function containsPlayerQr(config: ReturnType<typeof mergeSongConfig>): boolean {
  return JSON.stringify(config).includes(PLAYER_QR_IMAGE_NAME)
}

async function renderBatchFile(
  inputFile: string,
  targetFolder: string,
  playerUrl: string | undefined,
  format: 'A3' | 'A4' | 'A3-A4',
): Promise<void> {
  const abcText = await readFile(inputFile, 'utf8')
  const conf = new Confstack()
  const config = mergeSongConfig(initConf(conf), extractSongConfig(abcText))
  const resources = extractSongResources(abcText)
  const song = new AbcToSong().transform(new AbcParser().parse(abcText), config)
  const filebase = extractSongFilebase(abcText) ?? basename(inputFile, extname(inputFile))
  const formats: Array<'A3' | 'A4'> = format === 'A3-A4' ? ['A3', 'A4'] : [format]
  await mkdir(targetFolder, { recursive: true })

  for (const extractNr of resolveBatchExtracts(config)) {
    const filenamePart = extractFilenamePart(config, extractNr)
    let sheet = new HarpnotesLayout(config).layout(song, extractNr, formats[0] ?? 'A3')
    let playerLink: string | undefined

    if (containsPlayerQr(config) && playerUrl !== undefined) {
      const exportData = buildPlaybackExportData(song, sheet.activeVoices)
      const events: PlaybackEvent[] = exportData.events.map((event) => ({
        startMs: event.startMs,
        durationMs: event.durationMs,
        pitch: event.pitch,
        velocity: event.velocity,
        position: event.position,
      }))
      const link = await exportPlaybackLink(events, {
        playerUrl,
        positionMarkers: exportData.positionMarkers,
      }, nodePlaybackCodec)
      playerLink = link.url
    } else if (containsPlayerQr(config)) {
      log(`${inputFile}: $player_qr übersprungen, --player-url fehlt`)
    }

    for (const pageFormat of formats) {
      const imageResolver = (imageName: string): string | undefined => {
        if (imageName === PLAYER_QR_IMAGE_NAME && playerLink !== undefined) return dataUrlFromJpeg(createPlayerQrJpeg(playerLink))
        return resources[imageName]?.join('')
      }
      sheet = new HarpnotesLayout(config, { imageResolver }).layout(song, extractNr, pageFormat)
      const svgName = `${filebase}_${filenamePart}_${pageFormat.toLowerCase()}.svg`
      await writeFile(join(targetFolder, svgName), new SvgEngine().draw(sheet), 'utf8')
      const pdf = pageFormat === 'A3'
        ? new PdfEngine().draw(sheet)
        : new PdfEngine().drawInSegments(sheet, config.layout.X_SPACING)
      const pdfBytes = new Uint8Array(await pdf.arrayBuffer())
      await writeFile(join(targetFolder, pdfOutputFilename(filebase, filenamePart, pageFormat)), pdfBytes)
    }
  }
}

async function runLegacyBatch(args: string[]): Promise<number> {
  const fixtureExport = args[0] === '--export-fixtures'
  const batchArgs = fixtureExport ? args.slice(1) : args
  const positional: string[] = []
  for (let index = 0; index < batchArgs.length; index += 1) {
    const argument = batchArgs[index]
    if (argument === undefined) continue
    if (argument.startsWith('--')) {
      index += 1
      continue
    }
    positional.push(argument)
  }
  const [sourcepattern, targetfolder, configfile] = positional

  if (sourcepattern === undefined || targetfolder === undefined) {
    printUsage()
    return 1
  }

  const playerUrl = parseOption(args, '--player-url')
  const requestedFormat = parseOption(args, '--format') ?? 'A3-A4'
  if (requestedFormat !== 'A3' && requestedFormat !== 'A4' && requestedFormat !== 'A3-A4') {
    throw new Error(`Ungültiges Batch-Format: ${requestedFormat}`)
  }

  const files = await expandSourcePattern(sourcepattern)
  if (files.length === 0) {
    throw new Error(`Keine ABC-Dateien für ${sourcepattern} gefunden`)
  }

  log(`processing ${files.length} file(s) to ${targetfolder}`)
  if (configfile !== undefined) {
    log(`using config ${configfile}`)
  }
  if (fixtureExport) {
    log('fixture export mode requested')
  }
  for (const file of files) {
    await renderBatchFile(file, targetfolder, playerUrl, requestedFormat)
    log(`rendered ${file}`)
  }
  return 0
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
