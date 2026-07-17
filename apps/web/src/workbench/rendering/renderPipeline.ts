import {
  AbcParser,
  AbcToSong,
  Confstack,
  HarpnotesLayout,
  PdfEngine,
  SvgEngine,
  createDefaultAnnotationTextMetrics,
  extractSongConfig,
  initConf,
  mergeSongConfig,
} from '@zupfnoter/core'
import type { AbcParseError } from '@zupfnoter/core'
import type { SheetObjectIndex, SongDiagnostic } from '@zupfnoter/types'
import type { Sheet, Song, Voice, VoiceEntity } from '@zupfnoter/types'
import referenceSheetAbc from '../../../../../fixtures/cases/public/3015_reference_sheet/input.abc?raw'
import type { EditorDiagnostic } from '../panels/abcEditorCodeMirror'
import { buildPlaybackTimeline, resolveBaseTempoFromSong, type PlaybackStep } from '../playback'
import { isUserVisibleVoice, resolveActiveVoiceIdsFromSheet, resolveUserVisibleVoiceIds } from '../songVoiceIdentity'
import {
  parserErrorToWorkbenchDiagnostic,
  songDiagnosticToWorkbenchDiagnostic,
  workbenchDiagnosticHasPosition,
  type WorkbenchDiagnostic,
} from '../diagnostics'
import { buildSheetObjectIndex } from '../selectionIndex'

export interface RenderIssue {
  severity: 'warning' | 'error'
  message: string
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
  baseTempoFromQ?: number
  summary: string
  renderError?: string
}

/** Ein PDF-Ausgabeziel gemäß der effektiven Stückkonfiguration. */
export interface PdfExportVariant {
  extractNr: number
  filenamepart: string
}

export const DEFAULT_ABC = referenceSheetAbc

/** Erzeugt das PDF eines einzelnen Auszugs im gewünschten Seitenformat. */
export async function renderPdfExport(abcText: string, extractNr: number, pageFormat: 'A3' | 'A4'): Promise<Blob> {
  const config = buildConfig(abcText)
  const song = new AbcToSong().transform(new AbcParser().parse(abcText), config)
  const sheet = new HarpnotesLayout(config, { annotationTextMetrics: createDefaultAnnotationTextMetrics() }).layout(song, extractNr, pageFormat)
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
  const location = error.line === undefined ? '' : `line ${error.line}: `
  return {
    severity: 'error',
    message: `${location}${error.message}`,
    line: error.line,
    column: error.column,
  }
}

function scaleSvgForPreview(svg: string): string {
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
): WorkbenchRenderResult {
  const config = buildConfig(abcText)
  const keyHeaderDiagnostic = findInitialKeyHeaderDiagnostic(abcText)
  const scoreParser = new AbcParser()
  let scoreSvg = ''
  let scoreError: string | undefined
  try {
    scoreSvg = scaleSvgForPreview(scoreParser.renderSvg(abcText))
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
    }
    const sheet = new HarpnotesLayout(config, layoutOptions).layout(transformedSong, extractNr, 'A3')
    activeVoiceIds = resolveActiveVoiceIdsFromSheet(sheet)
    sheetObjectIndex = buildSheetObjectIndex(transformedSong, sheet as Sheet, abcText, scoreSvg)
    sheetChildCount = sheet.children.length
    harpSvg = scaleSvgForPreview(new SvgEngine().draw(sheet))
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
    baseTempoFromQ,
    summary,
    renderError,
  }
}
