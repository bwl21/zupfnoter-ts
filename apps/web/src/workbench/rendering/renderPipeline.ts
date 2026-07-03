import {
  AbcParser,
  AbcToSong,
  Confstack,
  HarpnotesLayout,
  SvgEngine,
  createDefaultAnnotationTextMetrics,
  extractSongConfig,
  initConf,
  mergeSongConfig,
} from '@zupfnoter/core'
import type { AbcParseError } from '@zupfnoter/core'
import type { SheetObjectIndex, SongDiagnostic } from '@zupfnoter/types'
import type { Sheet, Song, Voice, VoiceEntity } from '@zupfnoter/types'
import referenceSheetAbc from '../../../../../fixtures/cases/3015_reference_sheet/input.abc?raw'
import type { EditorDiagnostic } from '../panels/abcEditorCodeMirror'
import { buildPlaybackTimeline, resolveBaseTempoFromSong, type PlaybackStep } from '../playback'
import { resolveActiveVoiceIdsFromSheet, resolveUserVisibleVoiceIds } from '../songVoiceIdentity'
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

export const DEFAULT_ABC = referenceSheetAbc

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

export function renderWorkbenchPreviews(
  abcText: string,
  extractNr: number = 0,
): WorkbenchRenderResult {
  const config = buildConfig(abcText)
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

  const modelDiagnostics: WorkbenchDiagnostic[] = [
    ...modelParser.errors.map(parserErrorToWorkbenchDiagnostic),
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
    : `${allVoiceIds.length} voice(s), ${song.voices.filter((voice) => voice.index > 0).map((voice: Voice) => {
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
