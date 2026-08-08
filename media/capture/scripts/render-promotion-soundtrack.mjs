import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '../../..')
const outputDirectory = resolve(repositoryRoot, 'media-work/audio')
const sampleRate = 48000
const durationSeconds = 240

await mkdir(outputDirectory, { recursive: true })

function midiFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12)
}

function writeStereoWav(path, samples) {
  const dataSize = samples.length * 4
  const wav = Buffer.alloc(44 + dataSize)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(36 + dataSize, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(2, 22)
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(sampleRate * 4, 28)
  wav.writeUInt16LE(4, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(dataSize, 40)
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index]))
    const pcm = Math.round(value * 32767)
    wav.writeInt16LE(pcm, 44 + index * 4)
    wav.writeInt16LE(pcm, 46 + index * 4)
  }
  return writeFile(path, wav)
}

const melody = [
  [67, 1], [67, .5], [69, .5], [71, 1], [69, 1], [67, 1], [69, 1], [69, 1], [71, 1.5], [67, .5],
  [71, 1], [72, 1], [74, 1], [72, .5], [71, .5], [69, .5], [67, .5], [69, 1], [67, 1.5],
  [71, .5], [71, 1], [69, 1], [67, 1], [66, 1], [67, .5], [69, .5], [71, 1.5], [69, .5],
  [67, 1], [66, 1], [67, 1], [62, 1], [67, 1], [69, 1], [71, 1.5], [67, .5],
  [71, 1], [72, 1], [74, 1], [72, .5], [71, .5], [69, .5], [67, .5], [69, 1], [67, 2],
]

const music = new Float64Array(durationSeconds * sampleRate)
const beatSeconds = 60 / 80
let cursor = 0
while (cursor < durationSeconds - 2) {
  for (const [midi, beats] of melody) {
    const noteDuration = beats * beatSeconds
    const frequency = midiFrequency(midi)
    const start = Math.floor(cursor * sampleRate)
    const end = Math.min(music.length, start + Math.floor(Math.min(noteDuration + 1.8, 3) * sampleRate))
    for (let index = start; index < end; index += 1) {
      const time = (index - start) / sampleRate
      const attack = Math.min(1, time / .012)
      const decay = Math.exp(-2.1 * time)
      const tone = Math.sin(2 * Math.PI * frequency * time)
        + .38 * Math.sin(2 * Math.PI * frequency * 2 * time)
        + .15 * Math.sin(2 * Math.PI * frequency * 3 * time)
      music[index] += .18 * attack * decay * tone
    }
    cursor += noteDuration
    if (cursor >= durationSeconds - 2) break
  }
  cursor += 1.5
}

const clicks = new Float64Array(durationSeconds * sampleRate)
const clickScenes = [
  ['S-M01-01-warum-zupfnoter-ts', 7, .70],
  ['S-M03-01-speicherorte', 80, .62],
  ['S-M04-01-geschwindigkeit', 104, 1],
  ['S-M04-02-auswahlumfang', 128, .90],
  ['S-M05-01-konfiguration', 157, 1],
  ['S-M06-01-musikalische-wiedergabe', 187, 1],
  ['S-M06-02-qr-ueben', 217, 1.05],
]
const clickTimes = []
for (const [sceneId, sceneStart, speed] of clickScenes) {
  const eventData = JSON.parse(await readFile(resolve(repositoryRoot, `media-work/raw/${sceneId}.json`), 'utf8'))
  for (const event of eventData.events ?? []) {
    if (event.type === 'click') clickTimes.push(sceneStart + event.seconds / speed)
  }
}
for (const clickTime of clickTimes) {
  const start = Math.floor(clickTime * sampleRate)
  for (let offset = 0; offset < Math.floor(.09 * sampleRate); offset += 1) {
    const time = offset / sampleRate
    const envelope = Math.exp(-45 * time)
    clicks[start + offset] += .65 * envelope * Math.sin(2 * Math.PI * 1250 * time)
  }
}

await Promise.all([
  writeStereoWav(resolve(outputDirectory, 'krippen-demo-background.wav'), music),
  writeStereoWav(resolve(outputDirectory, 'promotion-clicks.wav'), clicks),
])

console.log(outputDirectory)
