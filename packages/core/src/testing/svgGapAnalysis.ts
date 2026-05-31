/**
 * SVG gap analysis helpers for legacy regression reports.
 *
 * Unlike `matchSvg`, which only answers "are the SVGs identical after
 * normalization?", these helpers produce a structured tag-by-tag comparison
 * suitable for a markdown gap report.
 */
import { normalizeSvgFixture } from './semanticMatch.js'

/** A single SVG tag with its tag name and the full normalized serialized form. */
export interface NormalizedTag {
  /** Lowercased tag name (e.g. "ellipse", "line"). */
  name: string
  /** Full normalized tag string as produced by `normalizeSvgFixture`. */
  raw: string
  /** True for closing tags (`</...>`). */
  isClosing: boolean
}

/** Per-tag-type count difference between legacy and TS output. */
export interface TagCountDiff {
  /** Tag name (e.g. "ellipse"). */
  name: string
  /** Number of occurrences in the legacy reference SVG. */
  legacy: number
  /** Number of occurrences in the TS-generated SVG. */
  ts: number
  /** `ts - legacy`. Negative means missing in TS, positive means extra in TS. */
  delta: number
}

/** Per-fixture summary for the SVG gap report. */
export interface SvgGapSummary {
  fixtureId: string
  extractNr: number
  legacyTagTotal: number
  tsTagTotal: number
  /** Tag types with `delta !== 0`, sorted by absolute delta descending. */
  tagCountDiffs: TagCountDiff[]
  /** First N normalized tags that differ when comparing in order. */
  firstMismatches: Array<{ index: number; legacy: string | undefined; ts: string | undefined }>
  /** True when both SVGs are structurally identical after normalization. */
  matches: boolean
}

const OPEN_OR_SELF_CLOSING_TAG = /<([a-zA-Z][^\s/>]*)[^>]*?\/?>/g
const CLOSING_TAG = /<\/([a-zA-Z][^\s>]*)\s*>/g

/**
 * Parses a normalized SVG string into a flat ordered list of tags.
 * Uses `normalizeSvgFixture` first so that attribute order and numeric
 * precision do not introduce false mismatches.
 */
export function parseNormalizedSvgTags(svg: string): NormalizedTag[] {
  const normalized = normalizeSvgFixture(svg).svg
  const tags: NormalizedTag[] = []

  // Scan once for opening / self-closing tags, then once for closing tags,
  // and finally sort by their start index to preserve document order.
  const collected: Array<{ start: number; tag: NormalizedTag }> = []

  const openPattern = new RegExp(OPEN_OR_SELF_CLOSING_TAG)
  let match: RegExpExecArray | null
  while ((match = openPattern.exec(normalized)) !== null) {
    const tagName = match[1]
    const raw = match[0]
    if (tagName === undefined) continue
    if (raw.startsWith('</')) continue
    collected.push({
      start: match.index,
      tag: { name: tagName.toLowerCase(), raw, isClosing: false },
    })
  }

  const closePattern = new RegExp(CLOSING_TAG)
  while ((match = closePattern.exec(normalized)) !== null) {
    const tagName = match[1]
    if (tagName === undefined) continue
    collected.push({
      start: match.index,
      tag: { name: tagName.toLowerCase(), raw: match[0], isClosing: true },
    })
  }

  collected.sort((a, b) => a.start - b.start)
  for (const { tag } of collected) tags.push(tag)
  return tags
}

/** Aggregates tag occurrences by tag name (counting opening / self-closing only). */
function countOpeningTags(tags: NormalizedTag[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const tag of tags) {
    if (tag.isClosing) continue
    counts[tag.name] = (counts[tag.name] ?? 0) + 1
  }
  return counts
}

/**
 * Computes per-tag-type count differences. Both presence-only and absent-only
 * tag types are included. Result is sorted by absolute delta descending so the
 * largest gaps appear first.
 */
export function diffTagCounts(legacyTags: NormalizedTag[], tsTags: NormalizedTag[]): TagCountDiff[] {
  const legacyCounts = countOpeningTags(legacyTags)
  const tsCounts = countOpeningTags(tsTags)
  const names = new Set([...Object.keys(legacyCounts), ...Object.keys(tsCounts)])
  const diffs: TagCountDiff[] = []
  for (const name of names) {
    const legacy = legacyCounts[name] ?? 0
    const ts = tsCounts[name] ?? 0
    if (legacy === ts) continue
    diffs.push({ name, legacy, ts, delta: ts - legacy })
  }
  diffs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.name.localeCompare(b.name))
  return diffs
}

/**
 * Finds the first `limit` positional mismatches between two normalized tag
 * streams. This is a pure index-by-index comparison, not an LCS — it is
 * intended as a quick localization hint, not a diff algorithm.
 */
export function findFirstMismatches(
  legacyTags: NormalizedTag[],
  tsTags: NormalizedTag[],
  limit: number,
): SvgGapSummary['firstMismatches'] {
  const mismatches: SvgGapSummary['firstMismatches'] = []
  const maxLength = Math.max(legacyTags.length, tsTags.length)
  for (let i = 0; i < maxLength && mismatches.length < limit; i++) {
    const legacy = legacyTags[i]
    const ts = tsTags[i]
    if (legacy?.raw === ts?.raw) continue
    mismatches.push({ index: i, legacy: legacy?.raw, ts: ts?.raw })
  }
  return mismatches
}

/**
 * Produces the structured per-fixture gap summary that feeds the markdown
 * report.
 */
export function summarizeSvgGap(args: {
  fixtureId: string
  extractNr: number
  legacy: string
  ts: string
  mismatchLimit?: number
}): SvgGapSummary {
  const legacyTags = parseNormalizedSvgTags(args.legacy)
  const tsTags = parseNormalizedSvgTags(args.ts)
  const tagCountDiffs = diffTagCounts(legacyTags, tsTags)
  const firstMismatches = findFirstMismatches(legacyTags, tsTags, args.mismatchLimit ?? 5)
  return {
    fixtureId: args.fixtureId,
    extractNr: args.extractNr,
    legacyTagTotal: legacyTags.filter((t) => !t.isClosing).length,
    tsTagTotal: tsTags.filter((t) => !t.isClosing).length,
    tagCountDiffs,
    firstMismatches,
    matches: tagCountDiffs.length === 0 && firstMismatches.length === 0,
  }
}
