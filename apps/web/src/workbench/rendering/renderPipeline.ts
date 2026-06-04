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
import type { Voice, VoiceEntity } from '@zupfnoter/types'
import referenceSheetAbc from '../../../../../fixtures/cases/3015_reference_sheet/input.abc?raw'

export interface RenderIssue {
  severity: 'warning' | 'error'
  message: string
}

export interface WorkbenchRenderResult {
  scoreSvg: string
  harpSvg: string
  issues: RenderIssue[]
  summary: string
}

export const DEFAULT_ABC = referenceSheetAbc

function parserIssueToRenderIssue(error: AbcParseError): RenderIssue {
  const severity = error.severity >= 1 ? 'error' : 'warning'
  const location = error.line === undefined ? '' : `line ${error.line}: `
  return {
    severity,
    message: `${location}${error.message}`,
  }
}

function scaleSvgForPreview(svg: string): string {
  return svg.replace(
    /(<svg[^>]*)\s+width="[^"]*"\s+height="[^"]*"/,
    '$1 width="100%" height="auto"',
  )
}

function buildConfig(abcText: string) {
  const conf = new Confstack()
  const defaults = initConf(conf)
  return mergeSongConfig(defaults, extractSongConfig(abcText))
}

export function renderWorkbenchPreviews(abcText: string): WorkbenchRenderResult {
  const config = buildConfig(abcText)
  const scoreParser = new AbcParser()
  const scoreSvg = scaleSvgForPreview(scoreParser.renderSvg(abcText))

  const modelParser = new AbcParser()
  const model = modelParser.parse(abcText)
  const song = new AbcToSong().transform(model, config)
  const sheet = new HarpnotesLayout(config, {
    annotationTextMetrics: createDefaultAnnotationTextMetrics(),
  }).layout(song, 0, 'A3')
  const harpSvg = scaleSvgForPreview(new SvgEngine().draw(sheet))

  const issues = [
    ...scoreParser.errors,
    ...modelParser.errors,
  ].map(parserIssueToRenderIssue)

  const noteCounts = song.voices.map((voice: Voice, index: number) => {
    const noteCount = voice.entities.filter((entity: VoiceEntity) => entity.type === 'Note').length
    return `V${index + 1}: ${noteCount} notes`
  })

  return {
    scoreSvg,
    harpSvg,
    issues,
    summary: `${song.voices.length} voice(s), ${noteCounts.join(', ')}, ${sheet.children.length} drawables`,
  }
}
