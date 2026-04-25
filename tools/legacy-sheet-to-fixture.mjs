#!/usr/bin/env node
/**
 * Converts a Legacy Sheet JSON (from zupfnoter-cli.js export) into the
 * SheetFixture format used by the zupfnoter-ts regression tests.
 *
 * Usage:
 *   node tools/legacy-sheet-to-fixture.mjs <input.sheet.json> [output.json]
 *
 *   # Convert a single file:
 *   node tools/legacy-sheet-to-fixture.mjs /tmp/znout/single_note.sheet.json fixtures/sheet/single_note.json
 *
 *   # Convert all files in a directory:
 *   for f in /tmp/znout/*.sheet.json; do
 *     name=$(basename "$f" .sheet.json)
 *     node tools/legacy-sheet-to-fixture.mjs "$f" "fixtures/sheet/${name}.json"
 *   done
 *
 * Legacy export (in controller.rb, after layouter.layout(...)):
 *   File.write("sheet_export.json", result.to_json)
 *
 * Class mapping (Legacy Ruby → TS):
 *   Harpnotes::Drawing::Ellipse    → Ellipse
 *   Harpnotes::Drawing::FlowLine   → FlowLine
 *   Harpnotes::Drawing::Glyph      → Glyph
 *   Harpnotes::Drawing::Annotation → Annotation
 *   Harpnotes::Drawing::Path       → Path
 *   Harpnotes::Drawing::Image      → Image
 *
 * Only visible elements are included (invisible elements are filtered out).
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ---------------------------------------------------------------------------
// Type mapping
// ---------------------------------------------------------------------------

const CLASS_TO_TYPE = {
  'Harpnotes::Drawing::Ellipse':    'Ellipse',
  'Harpnotes::Drawing::FlowLine':   'FlowLine',
  'Harpnotes::Drawing::Glyph':      'Glyph',
  'Harpnotes::Drawing::Annotation': 'Annotation',
  'Harpnotes::Drawing::Path':       'Path',
  'Harpnotes::Drawing::Image':      'Image',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a Ruby [x, y] array to a JS tuple, rounding to 4 decimal places. */
function toPoint(arr) {
  if (!Array.isArray(arr) || arr.length < 2) return undefined
  return [round(arr[0]), round(arr[1])]
}

function round(v) {
  return Math.round(v * 10000) / 10000
}

// ---------------------------------------------------------------------------
// Element conversion
// ---------------------------------------------------------------------------

function convertElement(e) {
  const type = CLASS_TO_TYPE[e['class']]
  if (!type) return null

  // Skip invisible elements
  if (e['@visible'] === false) return null

  const entry = { type }

  switch (type) {
    case 'Ellipse':
      if (e['@center'])    entry.center = toPoint(e['@center'])
      if (e['@size'])      entry.size   = toPoint(e['@size'])
      if (e['@fill']      !== undefined) entry.fill  = e['@fill'] ? 'filled' : 'empty'
      if (e['@color'])     entry.color  = e['@color']
      break

    case 'FlowLine':
      if (e['@from'])      entry.from  = toPoint(e['@from'])
      if (e['@to'])        entry.to    = toPoint(e['@to'])
      if (e['@style'])     entry.style = e['@style']
      if (e['@color'])     entry.color = e['@color']
      break

    case 'Glyph':
      if (e['@center'])    entry.center    = toPoint(e['@center'])
      if (e['@size'])      entry.size      = toPoint(e['@size'])
      if (e['@glyph_name']) entry.glyphName = e['@glyph_name']
      if (e['@color'])     entry.color     = e['@color']
      break

    case 'Annotation':
      if (e['@center'])    entry.center = toPoint(e['@center'])
      if (e['@text']      !== undefined) entry.text  = e['@text']
      if (e['@style'])     entry.style  = e['@style']
      if (e['@color'])     entry.color  = e['@color']
      break

    case 'Path': {
      // Legacy path is an array of [x, y] points
      const pts = e['@path']
      if (Array.isArray(pts)) {
        entry.path = pts.map(toPoint).filter(Boolean)
      }
      if (e['@color'])     entry.color = e['@color']
      break
    }

    case 'Image':
      if (e['@url'])       entry.url      = e['@url']
      if (e['@position'])  entry.position = toPoint(e['@position'])
      if (e['@height']    !== undefined) entry.height = e['@height']
      break
  }

  // Remove undefined fields
  return Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined))
}

// ---------------------------------------------------------------------------
// Main conversion
// ---------------------------------------------------------------------------

function convertSheet(legacySheet) {
  const rawChildren = legacySheet['children'] ?? legacySheet ?? []
  const children = (Array.isArray(rawChildren) ? rawChildren : [])
    .map(convertElement)
    .filter(Boolean)

  return { children }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
if (args.length < 1) {
  console.error('Usage: node tools/legacy-sheet-to-fixture.mjs <input.sheet.json> [output.json]')
  process.exit(1)
}

const inputPath  = resolve(args[0])
const outputPath = args[1] ? resolve(args[1]) : null

const raw     = readFileSync(inputPath, 'utf-8')
const legacy  = JSON.parse(raw)
const fixture = convertSheet(legacy)
const json    = JSON.stringify(fixture, null, 2) + '\n'

if (outputPath) {
  writeFileSync(outputPath, json, 'utf-8')
  console.log(`Written: ${outputPath}`)
} else {
  process.stdout.write(json)
}
