import {
  AbcParser,
  AbcToSong,
  Confstack,
  HarpnotesLayout,
  PdfEngine,
  SvgEngine,
  createDefaultAnnotationTextMetrics,
  extractSongConfig,
  extractSongResources,
  buildConfstack,
  initConf,
  mergeSongConfig,
  PLAYER_QR_IMAGE_NAME,
} from '@zupfnoter/core'
import type { AbcParseError } from '@zupfnoter/core'
import type { PlaybackConfig, SheetObjectIndex, SongDiagnostic, SongResources } from '@zupfnoter/types'
import type { Sheet, Song, Voice, VoiceEntity } from '@zupfnoter/types'
import startupDemoAbc from '../../../../../fixtures/cases/public/krippen-demo/input.abc?raw'
import type { EditorDiagnostic } from '../panels/abcEditorCodeMirror'
import { DEFAULT_WORKBENCH_CONFIG } from '../../stores/workbenchConfigDefaults'
import { buildPlaybackTimeline, resolveBaseTempoFromSong, resolveTempoUnitFromSong, type PlaybackStep } from '../playback'
import { createPlaybackLinkFromTimeline, createPlayerQrJpeg } from '../playbackLink'
import { isUserVisibleVoice, resolveActiveVoiceIdsFromSheet, resolveUserVisibleVoiceIds } from '../songVoiceIdentity'
import {
  parserErrorToWorkbenchDiagnostic,
  songDiagnosticToWorkbenchDiagnostic,
  workbenchDiagnosticHasPosition,
  ABC_PARSER_DIAGNOSTIC_SOURCE,
  type WorkbenchDiagnostic,
} from '../diagnostics'
import { buildSheetObjectIndex } from '../selectionIndex'

export interface RenderIssue {
  severity: 'warning' | 'error'
  message: string
  source?: string
  line?: number
  column?: number
}

export interface WorkbenchRenderResult {
  scoreSvg: string
  harpSvg: string
  sheetObjectIndex?: SheetObjectIndex
  activeVoiceIds: string[]
  allVoiceIds: string[]
  issues: RenderIssue[]
  diagnostics: WorkbenchDiagnostic[]
  toastDiagnostics: WorkbenchDiagnostic[]
  editorDiagnostics: EditorDiagnostic[]
  playbackTimeline: PlaybackStep[]
  song?: Song
  baseTempoFromQ?: number
  tempoUnitFromQ?: number
  playbackConfig?: PlaybackConfig
  summary: string
  renderError?: string
}

export interface WorkbenchComparisonResult {
  reference: WorkbenchRenderResult
  comparison: WorkbenchRenderResult
}

export interface WorkbenchRenderOptions {
  /** Separat vom Konfigurations-JSON gespeicherte Bildressourcen. */
  resources?: SongResources
  /** Temporär erzeugtes JPG für das reservierte Player-QR-Bild. */
  playerQrJpegUrl?: string
  /** Basis-URL des Players; wird beim PDF-Export pro Auszug aufgelöst. */
  playerUrl?: string
  /** Aktiviert editierbare Bézier-Handles an nicht konfigurierten Flusslinien. */
  flowconf?: boolean
}

function resolveResourceUrl(resources: SongResources | undefined, imageName: string): string | undefined {
  const parts = resources?.[imageName]
  return parts === undefined ? undefined : parts.join('')
}

/** Ein PDF-Ausgabeziel gemäß der effektiven Stückkonfiguration. */
export interface PdfExportVariant {
  extractNr: number
  filenamepart: string
}

export const DEFAULT_ABC = startupDemoAbc

/** Erzeugt das PDF eines einzelnen Auszugs im gewünschten Seitenformat. */
export async function renderPdfExport(
  abcText: string,
  extractNr: number,
  pageFormat: 'A3' | 'A4',
  options: WorkbenchRenderOptions = {},
): Promise<Blob> {
  const config = buildConfig(abcText)
  const resources = options.resources ?? extractSongResources(abcText)
  const song = new AbcToSong().transform(new AbcParser().parse(abcText), config)
  let sheet = new HarpnotesLayout(config, {
    annotationTextMetrics: createDefaultAnnotationTextMetrics(),
    imageResolver: (imageName) => imageName === PLAYER_QR_IMAGE_NAME
      ? options.playerQrJpegUrl
      : resolveResourceUrl(resources, imageName),
    flowconf: false,
  }).layout(song, extractNr, pageFormat)
  let playerQrJpegUrl = options.playerQrJpegUrl
  if (playerQrJpegUrl === undefined && options.playerUrl !== undefined && abcText.includes(PLAYER_QR_IMAGE_NAME)) {
    // Use the same web timeline as the Share/Playback-Link command. A second
    // export calculation can differ for ties, repeats and extract voice sets.
    const playbackTimeline = buildPlaybackTimeline(song, sheet.activeVoices)
    const playbackLink = await createPlaybackLinkFromTimeline(
      playbackTimeline,
      options.playerUrl,
      undefined,
      10,
      resolveBaseTempoFromSong(song),
      resolveTempoUnitFromSong(song),
      resolvePlaybackConfig(config, extractNr),
    )
    playerQrJpegUrl = await createPlayerQrJpeg(playbackLink.url)
    sheet = new HarpnotesLayout(config, {
      annotationTextMetrics: createDefaultAnnotationTextMetrics(),
      imageResolver: (imageName) => imageName === PLAYER_QR_IMAGE_NAME
        ? playerQrJpegUrl
        : resolveResourceUrl(resources, imageName),
      flowconf: false,
    }).layout(song, extractNr, pageFormat)
  }
  const engine = new PdfEngine()
  return pageFormat === 'A3'
    ? engine.draw(sheet)
    : engine.drawInSegments(sheet, config.layout.X_SPACING)
}

/** Ermittelt die laut Konfiguration zu speichernden Auszüge samt Dateinamenzusatz. */
export function resolvePdfExportVariants(abcText: string, fallbackExtract: number): PdfExportVariant[] {
  const config = buildConfig(abcText)
  const extracts = config.produce !== undefined && config.produce.length > 0
    ? config.produce
    : [fallbackExtract]

  return extracts.map((extractNr) => {
    const extract = config.extract[String(extractNr)]
    const filenamepart = extract?.filenamepart?.trim() || extract?.title?.trim() || String(extractNr)
    return { extractNr, filenamepart }
  })
}

/** Erzeugt die HTML-Vorschau, die zusammen mit dem Stück gespeichert wird. */
export function renderHtmlExport(abcText: string): string {
  const svg = new AbcParser().renderSvg(abcText)
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Zupfnoter</title></head><body>${svg}</body></html>`
}

function parserIssueToRenderIssue(error: AbcParseError): RenderIssue {
  return {
    severity: 'error',
    message: error.message,
    source: ABC_PARSER_DIAGNOSTIC_SOURCE,
    line: error.line,
    column: error.column,
  }
}

function scaleHarpSvgForPreview(svg: string): string {
  return svg.replace(
    /(<svg[^>]*)\s+width="[^"]*"\s+height="[^"]*"/,
    '$1 width="100%"',
  )
}

function buildConfig(abcText: string) {
  const conf = new Confstack()
  const defaults = initConf(conf)
  return mergeSongConfig(defaults, extractSongConfig(abcText))
}

function resolvePlaybackConfig(config: ReturnType<typeof buildConfig>, extractNr: number): PlaybackConfig | undefined {
  return buildConfstack(config, extractNr).get(`extract.${extractNr}.playback`) as PlaybackConfig | undefined
}

/** Meldet eine fehlende oder leere anfängliche Tonartzeile vor dem Konfigurationsblock. */
function findInitialKeyHeaderDiagnostic(abcText: string): WorkbenchDiagnostic | undefined {
  const configMarkerLine = abcText.indexOf('%%%%zupfnoter.config')
  const notationSource = configMarkerLine < 0 ? abcText : abcText.slice(0, configMarkerLine)
  const lines = notationSource.split('\n')
  const keyLineIndex = lines.findIndex((line) => line.startsWith('K:'))

  if (keyLineIndex < 0) {
    return {
      severity: 'error',
      message: 'Eine Tonartzeile K: fehlt. Zum Beispiel: K:C',
      source: 'abc-header',
      startPos: [1, 1],
      endPos: [1, 1],
    }
  }

  const keyValue = lines[keyLineIndex]?.slice(2).trim() ?? ''
  if (keyValue.length === 0 || keyValue.startsWith('%')) {
    const line = keyLineIndex + 1
    return {
      severity: 'error',
      message: 'Die Tonartzeile K: braucht einen Wert. Zum Beispiel: K:C',
      source: 'abc-header',
      startPos: [line, 1],
      endPos: [line, 1],
    }
  }

  return undefined
}

export function renderWorkbenchPreviews(
  abcText: string,
  extractNr: number = 0,
  options: WorkbenchRenderOptions = {},
): WorkbenchRenderResult {
  const config = buildConfig(abcText)
  const resources = options.resources ?? extractSongResources(abcText)
  const keyHeaderDiagnostic = findInitialKeyHeaderDiagnostic(abcText)
  const scoreParser = new AbcParser()
  let scoreSvg = ''
  let scoreError: string | undefined
  try {
    // Keep abc2svg's page width from the ABC/%%pagewidth instructions.
    scoreSvg = scoreParser.renderSvg(abcText)
  } catch (error) {
    scoreError = error instanceof Error ? error.message : String(error)
  }

  const modelParser = new AbcParser()
  let harpSvg = ''
  let song: ReturnType<AbcToSong['transform']> | null = null
  let sheetChildCount = 0
  let activeVoiceIds: string[] = []
  let allVoiceIds: string[] = []
  let modelError: string | undefined
  let sheetObjectIndex: SheetObjectIndex | undefined
  try {
    const parsedModel = modelParser.parse(abcText)
    const transformedSong = new AbcToSong().transform(parsedModel, config)
    song = transformedSong
    allVoiceIds = resolveUserVisibleVoiceIds(transformedSong)
    const layoutOptions: ConstructorParameters<typeof HarpnotesLayout>[1] = {
      annotationTextMetrics: createDefaultAnnotationTextMetrics(),
      imageResolver: (imageName) => imageName === PLAYER_QR_IMAGE_NAME
        ? options.playerQrJpegUrl
        : resolveResourceUrl(resources, imageName),
      flowconf: options.flowconf ?? DEFAULT_WORKBENCH_CONFIG.flowconf,
      interactive: true,
    }
    const sheet = new HarpnotesLayout(config, layoutOptions).layout(transformedSong, extractNr, 'A3')
    activeVoiceIds = resolveActiveVoiceIdsFromSheet(sheet)
    sheetObjectIndex = buildSheetObjectIndex(transformedSong, sheet as Sheet, abcText, scoreSvg)
    sheetChildCount = sheet.children.length
    harpSvg = scaleHarpSvgForPreview(new SvgEngine({ interactive: true }).draw(sheet))
  } catch (error) {
    modelError = error instanceof Error ? error.message : String(error)
  }

  const parserDiagnostics = keyHeaderDiagnostic === undefined
    ? modelParser.errors.map(parserErrorToWorkbenchDiagnostic)
    : [keyHeaderDiagnostic]
  const modelDiagnostics: WorkbenchDiagnostic[] = [
    ...parserDiagnostics,
    ...((song?.metaData.diagnostics ?? []) as SongDiagnostic[]).map(songDiagnosticToWorkbenchDiagnostic),
  ]
  const issues = scoreParser.errors.map(parserIssueToRenderIssue)
  const editorDiagnostics = modelDiagnostics
    .filter(workbenchDiagnosticHasPosition)
    .map((diagnostic): EditorDiagnostic => ({
      severity: diagnostic.severity,
      message: diagnostic.message,
      line: diagnostic.startPos[0],
      column: diagnostic.startPos[1],
      source: diagnostic.source,
    }))
  const toastDiagnostics = modelDiagnostics.filter((diagnostic) => !workbenchDiagnosticHasPosition(diagnostic))
  const playbackTimeline = song === null ? [] : buildPlaybackTimeline(song as Song)
  const baseTempoFromQ = song === null ? undefined : resolveBaseTempoFromSong(song as Song)
  const tempoUnitFromQ = song === null ? undefined : resolveTempoUnitFromSong(song as Song)
  const playbackConfig = resolvePlaybackConfig(config, extractNr)

  const renderError = scoreError ?? modelError
  const summary = song === null
    ? 'render failed'
    : `${allVoiceIds.length} voice(s), ${song.voices.filter(isUserVisibleVoice).map((voice: Voice) => {
      const noteCount = voice.entities.filter((entity: VoiceEntity) => entity.type === 'Note').length
      return `V${voice.index}: ${noteCount} notes`
    }).join(', ')}, ${sheetChildCount} drawables`

  return {
    scoreSvg,
    harpSvg,
    sheetObjectIndex,
    activeVoiceIds,
    allVoiceIds,
    issues,
    diagnostics: modelDiagnostics,
    toastDiagnostics,
    editorDiagnostics,
    playbackTimeline,
    song: song ?? undefined,
    baseTempoFromQ,
    tempoUnitFromQ,
    playbackConfig,
    summary,
    renderError,
  }
}

/** Rendert beide Vergleichskandidaten unabhängig voneinander aus ihrem ABC. */
export function renderWorkbenchComparison(
  referenceText: string,
  comparisonText: string,
  extractNr: number,
): WorkbenchComparisonResult {
  return {
    // Der Vergleich ist eine statische Ausgabe. Interaktive Flusslinien würden
    // zusätzlich Bearbeitungshilfen rendern und vom eigentlichen Layout ablenken.
    reference: renderWorkbenchPreviews(referenceText, extractNr, { flowconf: false }),
    comparison: renderWorkbenchPreviews(comparisonText, extractNr, { flowconf: false }),
  }
}

/** Erzeugt die beiden PDF-Vergleichskandidaten unabhängig voneinander. */
export async function renderPdfComparison(
  referenceText: string,
  comparisonText: string,
  extractNr: number,
  pageFormat: 'A3' | 'A4',
): Promise<[Blob, Blob]> {
  return Promise.all([
    renderPdfExport(referenceText, extractNr, pageFormat),
    renderPdfExport(comparisonText, extractNr, pageFormat),
  ])
}
