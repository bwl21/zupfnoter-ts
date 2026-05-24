/**
 * Rich SVG comparison helpers for fixture-driven legacy parity work.
 *
 * The helpers intentionally separate the concerns that the old exact string
 * comparison conflated:
 * - structural SVG diffs
 * - semantic/grouping diffs
 * - interaction-anchor diffs
 * - pixel diffs rendered through an external SVG rasterizer
 */

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { normalizeSvgFixture } from './semanticMatch.js'
import {
  diffTagCounts,
  findFirstMismatches,
  parseNormalizedSvgTags,
  summarizeSvgGap,
  type TagCountDiff,
  type SvgGapSummary,
} from './svgGapAnalysis.js'

const LEGACY_INTEGRATION_CSS = [
  'rect.abcref, rect.zupfnoter-hitbox {',
  '  fill: grey;',
  '  fill-opacity: 0.01;',
  '}',
  'rect.abcref:hover, rect.zupfnoter-hitbox:hover {',
  '  fill-opacity: 0.5;',
  '}',
].join('\n')

// ---------------------------------------------------------------------------
// SVG tag parsing
// ---------------------------------------------------------------------------

interface ParsedTag {
  name: string
  raw: string
  attrs: Record<string, string>
  isClosing: boolean
}

const TAG_PATTERN = /<[^>]+>/g
const ATTRIBUTE_PATTERN = /([^\s=/>]+)\s*=\s*"([^"]*)"/g

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  let match: RegExpExecArray | null
  const pattern = new RegExp(ATTRIBUTE_PATTERN)
  while ((match = pattern.exec(tag)) !== null) {
    const key = match[1]
    const value = match[2]
    if (key === undefined || value === undefined) continue
    attrs[key] = value
  }
  return attrs
}

function parseTags(svg: string): ParsedTag[] {
  const tags: ParsedTag[] = []
  let match: RegExpExecArray | null

  const pattern = new RegExp(TAG_PATTERN)
  while ((match = pattern.exec(svg)) !== null) {
    const raw = match[0]
    if (raw.startsWith('</')) {
      const nameMatch = raw.match(/^<\/([^\s>]+)/)
      const name = nameMatch?.[1]
      if (name !== undefined) {
        tags.push({ name: name.toLowerCase(), raw, attrs: {}, isClosing: true })
      }
      continue
    }

    const nameMatch = raw.match(/^<([^\s/>]+)/)
    const name = nameMatch?.[1]
    if (name === undefined) continue
    tags.push({
      name: name.toLowerCase(),
      raw,
      attrs: parseAttributes(raw),
      isClosing: false,
    })
  }

  return tags
}

function injectSvgStyle(svg: string, css: string): string {
  const openTagEnd = svg.indexOf('>')
  if (openTagEnd < 0) return svg
  const style = `<style type="text/css"><![CDATA[\n${css}\n]]></style>`
  return `${svg.slice(0, openTagEnd + 1)}${style}${svg.slice(openTagEnd + 1)}`
}

// ---------------------------------------------------------------------------
// Semantic summaries
// ---------------------------------------------------------------------------

export interface SvgPixelDiffSummary {
  available: boolean
  comparedWidth?: number
  comparedHeight?: number
  differingPixels?: number
  diffRatio?: number
  diffImagePath?: string
  artifactDir?: string
  error?: string
}

export interface SvgStructuralDiffSummary {
  tagCountDiffs: TagCountDiff[]
  firstMismatches: SvgGapSummary['firstMismatches']
  legacyGroupCount: number
  tsGroupCount: number
  legacyIdCount: number
  tsIdCount: number
  legacyClassCount: number
  tsClassCount: number
  legacyDataAttrCount: number
  tsDataAttrCount: number
  legacyExplicitFillCount: number
  tsExplicitFillCount: number
  legacyExplicitStrokeCount: number
  tsExplicitStrokeCount: number
}

export interface SvgInteractionDiffSummary {
  legacyAnchors: number
  tsAnchors: number
  legacyConfKeys: number
  tsConfKeys: number
  legacyZnIds: number
  tsZnIds: number
  legacyHitboxes: number
  tsHitboxes: number
  legacyTransparentHitboxes: number
  tsTransparentHitboxes: number
  legacyBlackHitboxes: number
  tsBlackHitboxes: number
}

export interface SvgComparisonSummary extends SvgGapSummary {
  pixelDiff: SvgPixelDiffSummary
  structuralDiff: SvgStructuralDiffSummary
  interactionDiff: SvgInteractionDiffSummary
}

function countTags(tags: ParsedTag[], tagName: string): number {
  return tags.filter((tag) => !tag.isClosing && tag.name === tagName).length
}

function countByPredicate(tags: ParsedTag[], predicate: (tag: ParsedTag) => boolean): number {
  return tags.filter((tag) => !tag.isClosing && predicate(tag)).length
}

function countDataAttrs(tag: ParsedTag): number {
  return Object.keys(tag.attrs).filter((key) => key.startsWith('data-')).length
}

function countExplicitFill(tags: ParsedTag[]): number {
  return countByPredicate(tags, (tag) => !tag.isClosing && ['rect', 'ellipse', 'line', 'path', 'text', 'image'].includes(tag.name) && tag.attrs.fill !== undefined)
}

function countExplicitStroke(tags: ParsedTag[]): number {
  return countByPredicate(tags, (tag) => !tag.isClosing && ['rect', 'ellipse', 'line', 'path', 'text', 'image'].includes(tag.name) && tag.attrs.stroke !== undefined)
}

function effectiveFill(tag: ParsedTag): string {
  return tag.attrs.fill ?? 'black'
}

function isTransparentHitbox(tag: ParsedTag): boolean {
  const role = tag.attrs['data-role']
  const className = tag.attrs.class ?? ''
  if (role !== 'hitbox' && !className.includes('zupfnoter-hitbox')) return false
  const fill = effectiveFill(tag)
  const stroke = tag.attrs.stroke ?? 'none'
  return (fill === 'transparent' || fill === 'none') && (stroke === 'transparent' || stroke === 'none')
}

function isBlackHitbox(tag: ParsedTag): boolean {
  const role = tag.attrs['data-role']
  const className = tag.attrs.class ?? ''
  if (role !== 'hitbox' && !className.includes('abcref') && !className.includes('zupfnoter-hitbox')) return false
  return tag.attrs.fill === 'black'
}

function countAnchors(tags: ParsedTag[]): number {
  return countByPredicate(tags, (tag) => tag.attrs.id !== undefined || tag.attrs['data-anchor'] !== undefined)
}

function countConfKeys(tags: ParsedTag[]): number {
  return countByPredicate(tags, (tag) => tag.attrs['data-conf-key'] !== undefined)
}

function countZnIds(tags: ParsedTag[]): number {
  return countByPredicate(tags, (tag) => tag.attrs['data-zn-id'] !== undefined)
}

function summarizePixelDiff(legacy: string, ts: string, artifactDir?: string): SvgPixelDiffSummary {
  const legacyRoot = parseTags(legacy).find((tag) => tag.name === 'svg' && !tag.isClosing)
  const tsRoot = parseTags(ts).find((tag) => tag.name === 'svg' && !tag.isClosing)

  const legacyWidth = Number.parseFloat(legacyRoot?.attrs.width ?? '')
  const legacyHeight = Number.parseFloat(legacyRoot?.attrs.height ?? '')
  const tsWidth = Number.parseFloat(tsRoot?.attrs.width ?? '')
  const tsHeight = Number.parseFloat(tsRoot?.attrs.height ?? '')

  const width = Number.isFinite(legacyWidth) ? legacyWidth : (Number.isFinite(tsWidth) ? tsWidth : 0)
  const height = Number.isFinite(legacyHeight) ? legacyHeight : (Number.isFinite(tsHeight) ? tsHeight : 0)
  if (width <= 0 || height <= 0) {
    return {
      available: false,
      error: 'Unable to determine rasterization dimensions from SVG width/height attributes.',
    }
  }

  try {
    const workdir = artifactDir ?? mkdtempSync(resolve(tmpdir(), 'zupfnoter-svg-diff-'))
    mkdirSync(workdir, { recursive: true })
    const legacySvgPath = resolve(workdir, 'legacy.svg')
    const tsSvgPath = resolve(workdir, 'ts.svg')
    const legacyPngPath = resolve(workdir, 'legacy.png')
    const tsPngPath = resolve(workdir, 'ts.png')
    const diffPngPath = resolve(workdir, 'diff.png')

    const legacyRasterSvg = injectSvgStyle(legacy, LEGACY_INTEGRATION_CSS)
    const tsRasterSvg = injectSvgStyle(ts, LEGACY_INTEGRATION_CSS)

    writeFileSync(legacySvgPath, legacyRasterSvg, 'utf-8')
    writeFileSync(tsSvgPath, tsRasterSvg, 'utf-8')

    const renderLegacy = spawnSync('rsvg-convert', ['-w', `${Math.round(width)}`, '-h', `${Math.round(height)}`, '-o', legacyPngPath, legacySvgPath], {
      encoding: 'utf-8',
    })
    const renderTs = spawnSync('rsvg-convert', ['-w', `${Math.round(width)}`, '-h', `${Math.round(height)}`, '-o', tsPngPath, tsSvgPath], {
      encoding: 'utf-8',
    })
    if (renderLegacy.status !== 0) {
      return { available: false, error: renderLegacy.stderr.trim() || 'rsvg-convert failed for legacy SVG.' }
    }
    if (renderTs.status !== 0) {
      return { available: false, error: renderTs.stderr.trim() || 'rsvg-convert failed for TS SVG.' }
    }

    const compare = spawnSync('compare', ['-metric', 'AE', legacyPngPath, tsPngPath, diffPngPath], {
      encoding: 'utf-8',
    })

    const metricText = compare.stderr.trim()
    const bracketMatch = metricText.match(/\(([\d.]+)\)\s*$/)
    const differingPixels = Number.parseFloat(bracketMatch?.[1] ?? metricText)
    return {
      available: true,
      comparedWidth: Math.round(width),
      comparedHeight: Math.round(height),
      differingPixels: Number.isFinite(differingPixels) ? differingPixels : undefined,
      diffRatio: Number.isFinite(differingPixels) ? differingPixels / (Math.round(width) * Math.round(height)) : undefined,
      diffImagePath: diffPngPath,
      artifactDir: workdir,
    }
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function summarizeStructuralDiff(legacy: string, ts: string): SvgStructuralDiffSummary {
  const legacyTags = parseTags(legacy)
  const tsTags = parseTags(ts)
  const tagCountDiffs = diffTagCounts(
    parseNormalizedSvgTags(legacy),
    parseNormalizedSvgTags(ts),
  )

  return {
    tagCountDiffs,
    firstMismatches: findFirstMismatches(
      parseNormalizedSvgTags(legacy),
      parseNormalizedSvgTags(ts),
      8,
    ),
    legacyGroupCount: countTags(legacyTags, 'g'),
    tsGroupCount: countTags(tsTags, 'g'),
    legacyIdCount: countByPredicate(legacyTags, (tag) => tag.attrs.id !== undefined),
    tsIdCount: countByPredicate(tsTags, (tag) => tag.attrs.id !== undefined),
    legacyClassCount: countByPredicate(legacyTags, (tag) => tag.attrs.class !== undefined),
    tsClassCount: countByPredicate(tsTags, (tag) => tag.attrs.class !== undefined),
    legacyDataAttrCount: countByPredicate(legacyTags, (tag) => countDataAttrs(tag) > 0),
    tsDataAttrCount: countByPredicate(tsTags, (tag) => countDataAttrs(tag) > 0),
    legacyExplicitFillCount: countExplicitFill(legacyTags),
    tsExplicitFillCount: countExplicitFill(tsTags),
    legacyExplicitStrokeCount: countExplicitStroke(legacyTags),
    tsExplicitStrokeCount: countExplicitStroke(tsTags),
  }
}

function summarizeInteractionDiff(legacy: string, ts: string): SvgInteractionDiffSummary {
  const legacyTags = parseTags(legacy)
  const tsTags = parseTags(ts)
  return {
    legacyAnchors: countAnchors(legacyTags),
    tsAnchors: countAnchors(tsTags),
    legacyConfKeys: countConfKeys(legacyTags),
    tsConfKeys: countConfKeys(tsTags),
    legacyZnIds: countZnIds(legacyTags),
    tsZnIds: countZnIds(tsTags),
    legacyHitboxes: countByPredicate(legacyTags, (tag) => tag.attrs['data-role'] === 'hitbox' || (tag.attrs.class ?? '').includes('abcref') || (tag.attrs.class ?? '').includes('znref')),
    tsHitboxes: countByPredicate(tsTags, (tag) => tag.attrs['data-role'] === 'hitbox' || (tag.attrs.class ?? '').includes('zupfnoter-hitbox')),
    legacyTransparentHitboxes: countByPredicate(legacyTags, (tag) => isTransparentHitbox(tag)),
    tsTransparentHitboxes: countByPredicate(tsTags, (tag) => isTransparentHitbox(tag)),
    legacyBlackHitboxes: countByPredicate(legacyTags, (tag) => isBlackHitbox(tag)),
    tsBlackHitboxes: countByPredicate(tsTags, (tag) => isBlackHitbox(tag)),
  }
}

export function compareSvgFixtures(args: {
  fixtureId: string
  extractNr: number
  legacy: string
  ts: string
  mismatchLimit?: number
  artifactDir?: string
}): SvgComparisonSummary {
  const svgGap = summarizeSvgGap(args)
  return {
    ...svgGap,
    pixelDiff: summarizePixelDiff(args.legacy, args.ts, args.artifactDir),
    structuralDiff: summarizeStructuralDiff(args.legacy, args.ts),
    interactionDiff: summarizeInteractionDiff(args.legacy, args.ts),
  }
}

export function formatPixelDiff(diff: SvgPixelDiffSummary): string[] {
  if (!diff.available) {
    return [`- Pixel diff unavailable: ${diff.error ?? 'unknown error'}`]
  }
  const lines = [
    `- Pixel diff compared at ${diff.comparedWidth}x${diff.comparedHeight}px`,
  ]
  if (diff.differingPixels !== undefined) {
    lines.push(`- Differing pixels: ${diff.differingPixels}`)
  }
  if (diff.diffRatio !== undefined) {
    lines.push(`- Diff ratio: ${(diff.diffRatio * 100).toFixed(3)}%`)
  }
  if (diff.diffImagePath !== undefined) {
    lines.push(`- Diff image: ${diff.diffImagePath}`)
  }
  return lines
}

export function formatStructuralDiff(diff: SvgStructuralDiffSummary): string[] {
  const lines = [
    `- Group count: legacy ${diff.legacyGroupCount}, ts ${diff.tsGroupCount}`,
    `- id count: legacy ${diff.legacyIdCount}, ts ${diff.tsIdCount}`,
    `- class count: legacy ${diff.legacyClassCount}, ts ${diff.tsClassCount}`,
    `- data-* count: legacy ${diff.legacyDataAttrCount}, ts ${diff.tsDataAttrCount}`,
    `- explicit fill count: legacy ${diff.legacyExplicitFillCount}, ts ${diff.tsExplicitFillCount}`,
    `- explicit stroke count: legacy ${diff.legacyExplicitStrokeCount}, ts ${diff.tsExplicitStrokeCount}`,
  ]
  if (diff.tagCountDiffs.length > 0) {
    lines.push('')
    lines.push('  Tag count deltas:')
    for (const delta of diff.tagCountDiffs) {
      const sign = delta.delta > 0 ? '+' : ''
      lines.push(`  - ${delta.name}: ${delta.legacy} -> ${delta.ts} (${sign}${delta.delta})`)
    }
  }
  if (diff.firstMismatches.length > 0) {
    lines.push('')
    lines.push('  First positional mismatches:')
    for (const mismatch of diff.firstMismatches) {
      lines.push(`  - index ${mismatch.index}`)
      lines.push(`    legacy: ${mismatch.legacy ?? '(none)'}`)
      lines.push(`    ts:     ${mismatch.ts ?? '(none)'}`)
    }
  }
  return lines
}

export function formatInteractionDiff(diff: SvgInteractionDiffSummary): string[] {
  return [
    `- Anchors: legacy ${diff.legacyAnchors}, ts ${diff.tsAnchors}`,
    `- data-conf-key: legacy ${diff.legacyConfKeys}, ts ${diff.tsConfKeys}`,
    `- data-zn-id: legacy ${diff.legacyZnIds}, ts ${diff.tsZnIds}`,
    `- Hitboxes: legacy ${diff.legacyHitboxes}, ts ${diff.tsHitboxes}`,
    `- Transparent hitboxes: legacy ${diff.legacyTransparentHitboxes}, ts ${diff.tsTransparentHitboxes}`,
    `- Black hitboxes: legacy ${diff.legacyBlackHitboxes}, ts ${diff.tsBlackHitboxes}`,
  ]
}

export function normalizeSvgForReport(svg: string): string {
  return normalizeSvgFixture(svg).svg
}
