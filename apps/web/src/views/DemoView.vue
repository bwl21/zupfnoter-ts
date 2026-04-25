<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ZupfnoterConfig } from '@zupfnoter/types'
import { AbcParser, AbcToSong, HarpnotesLayout, SvgEngine } from '@zupfnoter/core'

// ---------------------------------------------------------------------------
// Inline config (minimal – only fields required by the pipeline)
// ---------------------------------------------------------------------------

const config: ZupfnoterConfig = {
  layout: {
    ELLIPSE_SIZE: [3.5, 1.7],
    REST_SIZE: [4.0, 2.0],
    LINE_THIN: 0.1,
    LINE_MEDIUM: 0.3,
    LINE_THICK: 0.5,
    Y_SCALE: 0.1,
    X_SPACING: 11.5,
    X_OFFSET: 2.0,
    PITCH_OFFSET: -43,
    SHORTEST_NOTE: 96,
    BEAT_RESOLUTION: 384,
    BEAT_PER_DURATION: 1,
    DRAWING_AREA_SIZE: [400, 282],
    MM_PER_POINT: 0.3528,
    color: {
      color_default: 'black',
      color_variant1: 'red',
      color_variant2: 'blue',
    },
    FONT_STYLE_DEF: {
      regular: { textColor: [0, 0, 0], fontSize: 12, fontStyle: 'normal' },
      bold:    { textColor: [0, 0, 0], fontSize: 12, fontStyle: 'bold' },
      large:   { textColor: [0, 0, 0], fontSize: 20, fontStyle: 'bold' },
      small:   { textColor: [0, 0, 0], fontSize: 9,  fontStyle: 'normal' },
      smaller: { textColor: [0, 0, 0], fontSize: 6,  fontStyle: 'normal' },
    },
    DURATION_TO_STYLE: {
      err: { sizeFactor: 2,    fill: 'filled', dotted: false },
      d96: { sizeFactor: 0.9,  fill: 'empty',  dotted: false, hasbarover: true  },
      d64: { sizeFactor: 0.9,  fill: 'empty',  dotted: false, hasbarover: true  },
      d48: { sizeFactor: 0.7,  fill: 'empty',  dotted: true,  hasbarover: true  },
      d32: { sizeFactor: 0.7,  fill: 'empty',  dotted: false, hasbarover: false },
      d24: { sizeFactor: 0.7,  fill: 'filled', dotted: true  },
      d16: { sizeFactor: 0.7,  fill: 'filled', dotted: false },
      d12: { sizeFactor: 0.5,  fill: 'filled', dotted: true  },
      d8:  { sizeFactor: 0.5,  fill: 'filled', dotted: false },
      d6:  { sizeFactor: 0.3,  fill: 'filled', dotted: true  },
      d4:  { sizeFactor: 0.3,  fill: 'filled', dotted: false },
      d3:  { sizeFactor: 0.1,  fill: 'filled', dotted: true  },
      d2:  { sizeFactor: 0.1,  fill: 'filled', dotted: false },
      d1:  { sizeFactor: 0.05, fill: 'filled', dotted: false },
    },
    REST_TO_GLYPH: {
      err: { scale: [2,   2  ], glyphName: 'rest_1',  dotted: false },
      d96: { scale: [0.9, 0.9], glyphName: 'rest_1',  dotted: false },
      d64: { scale: [0.9, 0.9], glyphName: 'rest_1',  dotted: false },
      d48: { scale: [0.5, 0.5], glyphName: 'rest_1',  dotted: true  },
      d32: { scale: [0.5, 0.5], glyphName: 'rest_1',  dotted: false },
      d24: { scale: [0.4, 0.7], glyphName: 'rest_4',  dotted: true  },
      d16: { scale: [0.4, 0.7], glyphName: 'rest_4',  dotted: false },
      d12: { scale: [0.3, 0.5], glyphName: 'rest_8',  dotted: true  },
      d8:  { scale: [0.3, 0.5], glyphName: 'rest_8',  dotted: false },
      d6:  { scale: [0.3, 0.4], glyphName: 'rest_16', dotted: true  },
      d4:  { scale: [0.3, 0.5], glyphName: 'rest_16', dotted: false },
      d3:  { scale: [0.3, 0.5], glyphName: 'rest_32', dotted: true  },
      d2:  { scale: [0.3, 0.5], glyphName: 'rest_32', dotted: false },
      d1:  { scale: [0.3, 0.5], glyphName: 'rest_64', dotted: false },
    },
    instrument: 'Harp',
    packer: { pack_method: 0 },
    limit_a3: false,
    grid: false,
  },
  extract: {
    '0': {
      voices: [1, 2, 3, 4],
      flowlines: [1, 3],
      subflowlines: [2, 4],
      jumplines: [1, 3],
      synchlines: [[1, 2], [3, 4]],
      layoutlines: [1, 2, 3, 4],
      startpos: 15,
    },
  },
  printer: {
    a3Offset: [0, 0],
    a4Offset: [0, 0],
    a4Pages: [0, 1, 2],
    showBorder: false,
  },
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const DEFAULT_ABC = `X:1
T:Single Note Test
C:Zupfnoter TS Tests
M:4/4
L:1/4
Q:1/4=120
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] C D E F | G A B c |]
`

const abcText = ref(DEFAULT_ABC)
const svgOutput = ref('')
const errorMessage = ref('')
const debugInfo = ref('')

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

function renderAbc(text: string): void {
  try {
    const parser = new AbcParser()
    const model = parser.parse(text)
    if (parser.errors.length > 0) {
      const errs = parser.errors.map(e => `[${e.severity}] line ${e.line}: ${e.message}`).join('\n')
      errorMessage.value = errs
    } else {
      errorMessage.value = ''
    }
    const song  = new AbcToSong().transform(model, config)
    const sheet = new HarpnotesLayout(config).layout(song, 0, 'A3')
    // SvgEngine emits width/height in mm (correct for print/PDF).
    // Replace with 100% so the SVG scales to its container in the browser.
    const rawSvg = new SvgEngine().draw(sheet)
    svgOutput.value = rawSvg.replace(
      /(<svg[^>]*)\s+width="[^"]*"\s+height="[^"]*"/,
      '$1 width="100%" height="auto"',
    )
    const noteCounts = song.voices.map((v, i) =>
      `V${i+1}: ${v.entities.filter(e => e.type === 'Note').length} notes`
    ).join(', ')
    debugInfo.value = `voices=${song.voices.length} | ${noteCounts} | drawables=${sheet.children.length}`
  } catch (err) {
    errorMessage.value = err instanceof Error
      ? `${err.message}\n${err.stack ?? ''}`
      : String(err)
  }
}

// ---------------------------------------------------------------------------
// Debounce
// ---------------------------------------------------------------------------

let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(abcText, (text) => {
  if (debounceTimer !== null) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => renderAbc(text), 300)
}, { immediate: true })
</script>

<template>
  <div class="demo">
    <h1>Zupfnoter – SVG Demo</h1>

    <textarea
      v-model="abcText"
      class="abc-input"
      rows="10"
      spellcheck="false"
      placeholder="ABC-Notation eingeben…"
    />

    <div v-if="debugInfo" class="debug">{{ debugInfo }}</div>

    <div v-if="errorMessage" class="error">
      {{ errorMessage }}
    </div>

    <div
      class="svg-output"
      v-html="svgOutput"
    />
  </div>
</template>

<style scoped>
.demo {
  padding: 1rem;
  font-family: monospace;
  max-width: 100%;
}

h1 {
  font-family: sans-serif;
  font-size: 1.2rem;
  margin-bottom: 0.75rem;
}

.abc-input {
  width: 100%;
  box-sizing: border-box;
  font-family: monospace;
  font-size: 0.85rem;
  padding: 0.5rem;
  border: 1px solid #ccc;
  resize: vertical;
}

.debug {
  margin-top: 0.5rem;
  padding: 0.25rem 0.5rem;
  background: #f5f5f5;
  border: 1px solid #ddd;
  color: #555;
  font-size: 0.75rem;
}

.error {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #fee;
  border: 1px solid #f88;
  color: #c00;
  font-size: 0.85rem;
  white-space: pre-wrap;
}

.svg-output {
  margin-top: 0.75rem;
  overflow: auto;
  border: 1px solid #eee;
}
</style>
