#!/usr/bin/env node

// CLI entry point for Zupfmanager QR sheet generation.

import { execFile as execFileCallback } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { deflateRaw } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'

import {
  AbcParser,
  AbcToSong,
  buildConfstack,
  Confstack,
  HarpnotesLayout,
  buildPlaybackExportData,
  extractSongConfig,
  initConf,
  mergeSongConfig,
  playerQrJpegDataUrl,
} from '@zupfnoter/core'
import { exportPlaybackLink, type PlaybackCompressionCodec, type PlaybackEvent } from '@zupfnoter/playback'

const execFile = promisify(execFileCallback)
const deflateRawAsync = promisify(deflateRaw)
const DEFAULT_DATABASE = '/Users/beweiche/beweiche_noTimeMachine/200_Zupfnotenprojekte/11_Zupfmanager/zupfmanager.db'
const DEFAULT_PLAYER_URL = 'https://zupfnoter-player.csweichel.dev/'
const DEFAULT_PER_PAGE = 35

interface Project {
  id: number
  title: string
  short_name: string
  abc_file_dir_preference: string | null
}

interface ProjectSong {
  id: number
  title: string
  filename: string
}

interface Options {
  database: string
  project: string
  output?: string
  playerUrl: string
  abcRoot?: string
  perPage: number
}

interface QrEntry {
  label: string
  imageName: string
  imageDataUrl: string
}

interface QrGroup {
  suffix: 'AM' | 'B'
  entries: QrEntry[]
}

interface QrPosition {
  x: number
  y: number
  size: number
}

const nodePlaybackCodec: PlaybackCompressionCodec = {
  async compress(value) {
    return new Uint8Array(await deflateRawAsync(Buffer.from(value)))
  },
  async decompress() {
    throw new Error('Dekompression wird für die QR-Erzeugung nicht benötigt.')
  },
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index < 0 ? undefined : args[index + 1]
}

function showHelp(): void {
  console.log(`Zupfmanager QR Sheet Generator

Erzeugt aus einem Zupfmanager-Projekt Player-QR-ABC-Dateien.

Aufruf:
  zupfmanager-qr-sheet-generator --project <id|kurzname> [Optionen]

Optionen:
  --project <id|kurzname>  Projekt aus der Datenbank
  --database <pfad>        Pfad zu zupfmanager.db
  --abc-root <pfad>        Optionaler Vorrang für ABC-Dateien
  --output <pfad>          Ausgabebasis; standardmäßig <projekt>/player-qr/<projekt>_player-qr.abc
  --player-url <url>       Player-Basis-URL
  --per-page <zahl>        Maximale QR-Anzahl pro Blatt (1–35)
  --help                   Diese Hilfe anzeigen
`)
}

function parseOptions(args: string[]): Options {
  const project = option(args, '--project')
  if (project === undefined || project.trim() === '') {
    throw new Error('Bitte --project <id|kurzname> angeben.')
  }
  const perPage = Number(option(args, '--per-page') ?? DEFAULT_PER_PAGE)
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > 35) {
    throw new Error('--per-page muss eine ganze Zahl zwischen 1 und 35 sein.')
  }
  return {
    database: resolve(option(args, '--database') ?? DEFAULT_DATABASE),
    project,
    output: option(args, '--output') === undefined
      ? undefined
      : resolve(option(args, '--output') as string),
    playerUrl: option(args, '--player-url') ?? DEFAULT_PLAYER_URL,
    abcRoot: option(args, '--abc-root'),
    perPage,
  }
}

async function queryJson<T>(database: string, sql: string): Promise<T[]> {
  const result = await execFile('sqlite3', ['-json', database, sql])
  const parsed: unknown = JSON.parse(result.stdout.trim() || '[]')
  if (!Array.isArray(parsed)) throw new Error('sqlite3 lieferte kein Array.')
  return parsed as T[]
}

async function loadProject(options: Options): Promise<Project> {
  const projects = await queryJson<Project>(
    options.database,
    'SELECT id,title,short_name,abc_file_dir_preference FROM projects',
  )
  const project = projects.find((entry) =>
    entry.short_name === options.project || String(entry.id) === options.project)
  if (project === undefined) throw new Error('Projekt nicht gefunden: ' + options.project)
  return project
}

async function loadPriorityOneSongs(database: string, projectId: number): Promise<ProjectSong[]> {
  const songs = await queryJson<ProjectSong>(
    database,
    'SELECT s.id,s.title,s.filename FROM project_songs ps ' +
      'JOIN songs s ON s.id=ps.song_id ' +
      'WHERE ps.project_id=' + projectId + ' AND ps.priority=1',
  )
  const collator = new Intl.Collator('de-DE', { sensitivity: 'base', numeric: true })
  return songs.sort((a, b) =>
    collator.compare(a.title, b.title)
    || collator.compare(a.filename, b.filename)
    || a.id - b.id)
}

async function resolveAbcFile(project: Project, filename: string, options: Options): Promise<string> {
  const databaseDirectory = dirname(options.database)
  const roots = [
    options.abcRoot,
    resolve(databaseDirectory, project.short_name, 'abc'),
    resolve(databaseDirectory, project.short_name),
    project.abc_file_dir_preference === null
      ? undefined
      : resolve(project.abc_file_dir_preference, project.short_name, 'abc'),
    project.abc_file_dir_preference === null
      ? undefined
      : resolve(project.abc_file_dir_preference, project.short_name),
  ].filter((root): root is string => root !== undefined)
  for (const root of roots) {
    const candidate = resolve(root, filename)
    try {
      await readFile(candidate, 'utf8')
      return candidate
    } catch {
      // Nächsten bekannten Projektpfad versuchen.
    }
  }
  throw new Error('ABC-Datei nicht gefunden: ' + filename + '\nGeprüfte Verzeichnisse:\n' + roots.join('\n'))
}

function extractLabel(config: ReturnType<typeof mergeSongConfig>, extractNr: number): string {
  const extract = config.extract[String(extractNr)]
  const raw = extract?.filenamepart?.trim() || extract?.title?.trim() || String(extractNr)
  return raw.replace(/^-+/, '')
}

async function makeQrEntries(
  number: number,
  abcFile: string,
  playerUrl: string,
): Promise<QrEntry[]> {
  const abcText = await readFile(abcFile, 'utf8')
  const config = mergeSongConfig(initConf(new Confstack()), extractSongConfig(abcText))
  const song = new AbcToSong().transform(new AbcParser().parse(abcText), config)
  const configuredProduce = config.produce ?? []
  const extractNumbers = configuredProduce.length > 0 ? [...new Set(configuredProduce)] : [0]
  const entries: QrEntry[] = []
  for (const extractNr of extractNumbers) {
    const sheet = new HarpnotesLayout(config).layout(song, extractNr, 'A3')
    const exportData = buildPlaybackExportData(song, sheet.activeVoices)
    const events: PlaybackEvent[] = exportData.events.map((event) => ({
      startMs: event.startMs,
      durationMs: event.durationMs,
      pitch: event.pitch,
      velocity: event.velocity,
      position: event.position,
    }))
    const tempo = song.metaData.tempo
    const tempoBpm = typeof tempo === 'number' ? tempo : tempo?.bpm
    const tempoUnit = typeof tempo === 'number' ? 0.25 : tempo?.duration[0]
    const playbackConfig = buildConfstack(config, extractNr).get(`extract.${extractNr}.playback`) as {
      metronomeMode?: 'off' | 'countIn' | 'playback' | 'always'
      minLeadIn?: number
      bandPreCount?: boolean
      division?: number
      subdivision?: number
    } | undefined
    const link = await exportPlaybackLink(events, {
      playerUrl,
      positionMarkers: exportData.positionMarkers,
      tempoBpm,
      tempoUnit,
      metronome: playbackConfig?.metronomeMode === undefined ? undefined : {
        mode: playbackConfig.metronomeMode,
        minLeadIn: playbackConfig.minLeadIn,
        bandPreCount: playbackConfig.bandPreCount,
        division: playbackConfig.division,
        subdivision: playbackConfig.subdivision,
      },
    }, nodePlaybackCodec)
    const label = String(number).padStart(3, '0') + '-' + extractLabel(config, extractNr)
    const playerLink = new URL(link.url)
    playerLink.searchParams.set('id', label)
    entries.push({
      label,
      imageName: 'player_qr_' + label.replace(/[^a-zA-Z0-9_-]/g, '_'),
      imageDataUrl: playerQrJpegDataUrl(playerLink.toString()),
    })
  }
  return entries
}

function qrPosition(index: number, count: number): QrPosition {
  const columns = Math.min(5, Math.max(1, count))
  const rows = Math.ceil(count / columns)
  const column = index % columns
  const row = Math.floor(index / columns)
  const xStart = 145
  const xEnd = 365
  const yStart = 50
  const yEnd = 254
  const yStep = rows === 1 ? Number.POSITIVE_INFINITY : (yEnd - yStart) / (rows - 1)
  return {
    x: columns === 1 ? xStart : xStart + column * (xEnd - xStart) / (columns - 1),
    y: rows === 1 ? yStart : yStart + row * (yEnd - yStart) / (rows - 1),
    size: Math.min(30, yStep - 5),
  }
}

function split(value: string, size: number): string[] {
  return Array.from(
    { length: Math.ceil(value.length / size) },
    (_entry, index) => value.slice(index * size, (index + 1) * size),
  )
}

function splitQrGroups(entries: QrEntry[]): QrGroup[] {
  const amEntries = entries.filter((entry) => /-(?:A|M)\d*$/.test(entry.label))
  const bEntries = entries.filter((entry) => !/(?:-)(?:A|M)\d*$/.test(entry.label))
  return [
    { suffix: 'AM' as const, entries: amEntries },
    { suffix: 'B' as const, entries: bEntries },
  ].filter((group) => group.entries.length > 0)
}

function createAbc(project: Project, group: QrGroup['suffix'], entries: QrEntry[], perPage: number): string {
  const pages: QrEntry[][] = []
  for (let index = 0; index < entries.length; index += perPage) {
    pages.push(entries.slice(index, index + perPage))
  }

  const extracts: Record<string, unknown> = {}
  const resources: Record<string, string[]> = {}
  pages.forEach((page, pageIndex) => {
    const images: Record<string, unknown> = {}
    const notes: Record<string, unknown> = {}
    page.forEach((entry, pagePosition) => {
      const position = qrPosition(pagePosition, page.length)
      const x = position.x
      const y = position.y
      images[String(pagePosition + 1)] = {
        imagename: entry.imageName,
        show: true,
        pos: [x, y],
        height: position.size,
      }
      notes['label_' + (pagePosition + 1)] = {
        pos: [x, y - 5],
        text: entry.label,
        style: 'small',
      }
      resources[entry.imageName] = split(entry.imageDataUrl, 60)
    })
    extracts[String(pageIndex)] = {
      title: 'Übungen ' + (pageIndex + 1),
      filenamepart: '-qr-' + (pageIndex + 1),
      layout: { instrument: '25-strings-g-g' },
      stringnames: { text: '', vpos: [], marks: { hpos: [], vpos: [] } },
      legend: { pos: [410, 7], align: 'l' },
      images,
      notes: {
        ...notes,
        T06_legend: {},
        T99_do_not_copy: {
          pos: [380, 284],
          text: 'Bitte nicht kopieren',
          style: 'small_bold',
        },
      },
      printer: { show_border: false },
    }
  })

  const config = {
    produce: pages.map((_page, index) => index),
    extract: extracts,
    layout: {
      limit_a3: true,
      color: { color_default: 'black', color_variant1: 'grey', color_variant2: 'dimgrey' },
    },
    template: { title: project.title + ' - Übungen' },
  }
  return [
    'X:999',
    'F:' + project.short_name + '_player_qr_' + group,
    'T:' + project.title,
    'M:4/4',
    'L:1/4',
    'Q:1/4=120',
    'K:C',
    'V:1 clef=treble',
    'x |]',
    '',
    '%%%%zupfnoter.config',
    '',
    JSON.stringify(config, null, 2),
    '',
    '%%%%zupfnoter.resources',
    '',
    JSON.stringify(resources, null, 2),
    '',
  ].join('\n')
}

function outputPath(basePath: string, suffix: QrGroup['suffix']): string {
  return basePath.endsWith('.abc')
    ? basePath.slice(0, -4) + '_' + suffix + '.abc'
    : basePath + '_' + suffix + '.abc'
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    showHelp()
    return
  }
  const options = parseOptions(args)
  const project = await loadProject(options)
  const output = options.output ?? resolve(
    dirname(options.database),
    project.short_name,
    'player-qr',
    project.short_name + '_player-qr.abc',
  )
  const songs = await loadPriorityOneSongs(options.database, project.id)
  if (songs.length === 0) throw new Error('Das Projekt enthält keine priority-1-Stücke.')
  console.log('Projekt: ' + project.title + ' (' + project.short_name + ')')
  console.log('priority 1: ' + songs.length + ' Stücke')

  const entries: QrEntry[] = []
  for (const [index, song] of songs.entries()) {
    const abcFile = await resolveAbcFile(project, song.filename, options)
    console.log((index + 1) + '/' + songs.length + ': ' + song.title + ' [' + abcFile + ']')
    entries.push(...await makeQrEntries(index + 1, abcFile, options.playerUrl))
  }

  const groups = splitQrGroups(entries)
  for (const group of groups) {
    const groupOutput = outputPath(output, group.suffix)
    await mkdir(dirname(groupOutput), { recursive: true })
    await writeFile(
      groupOutput,
      createAbc(project, group.suffix, group.entries, options.perPage),
      'utf8',
    )
    console.log('ABC-Datei geschrieben: ' + groupOutput)
    console.log('Seiten: ' + Math.ceil(group.entries.length / options.perPage))
    await renderWithZupfnoterCli(groupOutput)
  }
}

async function renderWithZupfnoterCli(abcFile: string): Promise<void> {
  const targetFolder = dirname(abcFile)
  const result = await execFile('pnpm', [
    '--filter',
    '@zupfnoter/cli',
    'exec',
    'node',
    'dist/index.js',
    abcFile,
    targetFolder,
    '--format',
    'A3',
  ])
  if (result.stdout.trim() !== '') console.log(result.stdout.trim())
  if (result.stderr.trim() !== '') console.error(result.stderr.trim())
  console.log('PDF-Datei(en) mit zupfnoter CLI erzeugt für: ' + abcFile)
}

await main()
