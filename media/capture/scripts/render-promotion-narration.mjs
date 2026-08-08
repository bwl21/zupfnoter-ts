import { readFile, mkdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDirectory, '../../..')
const source = resolve(root, 'media/narration/de/P-promotion-legacy-4min-v2.txt')
const outputDirectory = resolve(root, 'media-work/audio/narration-v2')
const voice = process.env.NARRATION_VOICE ?? 'Flo'
const rate = process.env.NARRATION_RATE ?? '182'
const starts = [0.6, 7.7, 22.7, 40.7, 50.7, 70.7, 100.7, 120.7, 149.7, 179.7, 210.7, 235.2]

await mkdir(outputDirectory, { recursive: true })
const content = await readFile(source, 'utf8')
const sections = [...content.matchAll(/^## ([^\n]+)\n([\s\S]*?)(?=\n## |$)/gm)]
  .map((match) => ({ id: match[1], text: match[2]?.trim() ?? '' }))
if (sections.length !== starts.length) throw new Error(`Erwartet: ${starts.length} Sprecherabschnitte, gefunden: ${sections.length}`)

const inputs = []
for (const section of sections) {
  const output = resolve(outputDirectory, `${section.id}.aiff`)
  const result = spawnSync('say', ['-v', voice, '-r', rate, '-o', output, section.text], { stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`Sprecherzeugung für ${section.id} fehlgeschlagen`)
  inputs.push(output)
}

const ffmpegInputs = inputs.flatMap((input) => ['-i', input])
const filters = inputs.map((_, index) => `[${index}:a]adelay=${Math.round(starts[index] * 1000)}:all=1[n${index}]`).join(';')
const mixInputs = inputs.map((_, index) => `[n${index}]`).join('')
const output = resolve(root, 'media-work/audio/narration-v2.wav')
const result = spawnSync('ffmpeg', [
  '-hide_banner', '-loglevel', 'warning', '-y', ...ffmpegInputs,
  '-f', 'lavfi', '-t', '240', '-i', 'anullsrc=r=48000:cl=stereo',
  '-filter_complex', `${filters};${mixInputs}[${inputs.length}:a]amix=inputs=${inputs.length + 1}:normalize=0:duration=longest[a]`,
  '-map', '[a]', '-t', '240', '-ar', '48000', '-ac', '2', output,
], { stdio: 'inherit' })
if (result.status !== 0) throw new Error('Zusammenstellung der Sprecheraufnahme fehlgeschlagen')

console.log(`${voice} · ${output}`)
