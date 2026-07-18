import { readFile } from 'node:fs/promises'
import { deflateSync } from '../apps/web/node_modules/fflate/esm/browser.js'
import { exportPlaybackLink } from '../packages/playback/dist/index.js'

const playerUrl = 'https://zupfnoter-player.csweichel.dev/'
const resolutionMs = 10

function writeVarUInt(output, value) {
  let remaining = value
  do {
    let byte = remaining % 128
    remaining = Math.floor(remaining / 128)
    if (remaining > 0) byte |= 128
    output.push(byte)
  } while (remaining > 0)
}

function base64Url(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function encodeLegacy(events) {
  const normalized = [...events].sort((left, right) => left.startMs - right.startMs || left.pitch - right.pitch)
  const header = [0x5a, 0x4e, 0x50, 1, 1]
  writeVarUInt(header, resolutionMs)
  writeVarUInt(header, normalized.length)
  const output = [...header]
  let previousStart = 0
  for (const event of normalized) {
    const start = Math.round(event.startMs / resolutionMs)
    writeVarUInt(output, start - previousStart)
    writeVarUInt(output, Math.max(1, Math.round(event.durationMs / resolutionMs)))
    output.push(event.pitch, event.velocity ?? 127)
    writeVarUInt(output, event.position.measureNumber)
    writeVarUInt(output, event.position.passIndex)
    previousStart = start
  }
  const binary = new Uint8Array(output)
  const compressed = new Uint8Array([...header, ...deflateSync(binary.slice(header.length))])
  const encoded = base64Url(compressed)
  return { binary: binary.length, compressed: compressed.length, base64: encoded.length, url: playerUrl.length + 3 + encoded.length }
}

function generatedEvents(count, pattern = 'normal') {
  return Array.from({ length: count }, (_, index) => {
    const simultaneousIndex = pattern === 'same-start' ? Math.floor(index / 8) : index
    return {
      startMs: simultaneousIndex * 120,
      durationMs: pattern === 'same-duration' ? 120 : 120 + (index % 4) * 60,
      pitch: 48 + (index % 36),
      velocity: pattern === 'variable-velocity' ? 80 + (index % 40) : 127,
      position: {
        measureNumber: Math.floor(index / 8) + 1,
        passIndex: pattern === 'many-passes' ? (Math.floor(index / 64) % 4) + 1 : 1,
      },
    }
  })
}

async function benchmark(name, events) {
  const codec = {
    compress: async (value) => new Uint8Array(deflateSync(value)),
    decompress: async (value) => value,
  }
  const result = await exportPlaybackLink(events, { playerUrl, timeResolutionMs: resolutionMs }, codec)
  const before = encodeLegacy(events)
  const after = {
    binary: result.analysis.binaryBytes,
    compressed: result.analysis.compressedBytes,
    base64: result.analysis.base64UrlChars,
    url: result.url.length,
  }
  console.log(JSON.stringify({ name, events: events.length, before, after, savedUrlCharacters: before.url - after.url }, null, 2))
}

const input = process.argv[2]
if (input !== undefined) {
  const events = JSON.parse(await readFile(input, 'utf8'))
  await benchmark(input, events)
} else {
  await benchmark('short', generatedEvents(8))
  await benchmark('example-565', generatedEvents(565))
  await benchmark('long', generatedEvents(5000))
  await benchmark('same-start', generatedEvents(1000, 'same-start'))
  await benchmark('variable-velocity', generatedEvents(1000, 'variable-velocity'))
  await benchmark('many-passes', generatedEvents(1000, 'many-passes'))
}
