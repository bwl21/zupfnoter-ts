<script setup lang="ts">
import { ref, watch } from 'vue'
import { AbcParser, AbcToSong, HarpnotesLayout, SvgEngine, Confstack, initConf, extractSongConfig, mergeSongConfig } from '@zupfnoter/core'

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
    // Layer 1: Defaults aus initConf(conf)
    // Layer 2: Song-Konfiguration aus %%%%zupfnoter.config im ABC-Text
    const conf       = new Confstack()
    const defaults   = initConf(conf)
    const songConfig = extractSongConfig(text)
    const config     = mergeSongConfig(defaults, songConfig)

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
