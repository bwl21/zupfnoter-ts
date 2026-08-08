import { mkdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDirectory, '../../..')
const work = resolve(root, 'media-work')
const segmentsDirectory = resolve(work, 'render/segments')
const outputDirectory = resolve(work, 'output')

await mkdir(segmentsDirectory, { recursive: true })
await mkdir(outputDirectory, { recursive: true })

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'warning', '-y', ...args], { stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`ffmpeg endete mit Status ${result.status ?? 'unbekannt'}`)
}

function rasterizeSvg(source) {
  const input = resolve(root, `media/diagrams/${source}`)
  const output = resolve(work, `render/${source.replace(/\.svg$/, '.png')}`)
  const result = spawnSync('rsvg-convert', ['--width', '1600', '--height', '900', '--output', output, input], { stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`rsvg-convert endete mit Status ${result.status ?? 'unbekannt'}`)
  return output
}

function slide(id, source, duration) {
  const output = resolve(segmentsDirectory, `${id}.mp4`)
  ffmpeg(['-loop', '1', '-framerate', '25', '-i', rasterizeSvg(source), '-t', String(duration),
    '-vf', `scale=1600:900:force_original_aspect_ratio=decrease,pad=1600:900:(ow-iw)/2:(oh-ih)/2:color=0x102a43,fps=25,fade=t=in:st=0:d=0.25,fade=t=out:st=${Math.max(0, duration - 0.25)}:d=0.25`,
    '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', output])
  return output
}

function screencast(id, source, duration, speed) {
  const output = resolve(segmentsDirectory, `${id}.mp4`)
  const effectiveDuration = duration / speed
  ffmpeg(['-i', resolve(work, `raw/${source}`), '-t', String(effectiveDuration),
    '-vf', `setpts=PTS/${speed},fps=25,tpad=stop_mode=clone:stop_duration=1,scale=1600:900:force_original_aspect_ratio=decrease,pad=1600:900:(ow-iw)/2:(oh-ih)/2:color=0x102a43,fade=t=in:st=0:d=0.2,fade=t=out:st=${Math.max(0, duration - 0.2)}:d=0.2`,
    '-t', String(duration), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', output])
  return output
}

const segments = [
  slide('00-intro', 'promo-intro.svg', 7),
  screencast('01-warum', 'S-M01-01-warum-zupfnoter-ts.webm', 15, .70),
  slide('02-bestand', 'promo-bestand.svg', 18),
  slide('03-tests', 'promo-tests.svg', 10),
  screencast('04-arbeitsplatz', 'S-M02-03-vertrauter-arbeitsplatz.webm', 20, .68),
  slide('05-speicher-diagramm', 'promo-speicher.svg', 10),
  screencast('05-speicher-ui', 'S-M03-01-speicherorte.webm', 20, .62),
  slide('06-tempo-diagramm', 'promo-tempo.svg', 4),
  screencast('06-tempo', 'S-M04-01-geschwindigkeit.webm', 16, 1),
  slide('07-auswahl-diagramm', 'promo-auswahl.svg', 8),
  screencast('07-auswahl-ui', 'S-M04-02-auswahlumfang.webm', 21, .90),
  slide('08-konfiguration-diagramm', 'promo-konfiguration.svg', 8),
  screencast('08-konfiguration', 'S-M05-01-konfiguration.webm', 22, 1),
  slide('09-player-diagramm', 'promo-wiedergabe.svg', 8),
  screencast('09-player-ui', 'S-M06-01-musikalische-wiedergabe.webm', 23, 1),
  slide('10-qr', 'promo-qr.svg', 7),
  screencast('10-player', 'S-M06-02-qr-ueben.webm', 18, 1.05),
  slide('11-outro', 'promo-outro.svg', 5),
]

const concatPath = resolve(work, 'render/segments.txt')
const concatContent = segments.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join('\n')
await import('node:fs/promises').then(({ writeFile }) => writeFile(concatPath, concatContent))

const silentVideo = resolve(work, 'render/promotion-silent.mp4')
ffmpeg(['-f', 'concat', '-safe', '0', '-i', concatPath, '-c', 'copy', silentVideo])

const playbackEvents = JSON.parse(await import('node:fs/promises').then(({ readFile }) => readFile(resolve(work, 'raw/S-M06-01-musikalische-wiedergabe.json'), 'utf8')))
const playbackClick = playbackEvents.events?.find((event) => event.label === 'Wiedergabe starten')
if (playbackClick === undefined) throw new Error('Zeitpunkt des Wiedergabestarts fehlt')
const playbackDelayMs = Math.round((187 + playbackClick.seconds) * 1000)
const playbackDurationSeconds = 210 - playbackDelayMs / 1000
const playerEvents = JSON.parse(await import('node:fs/promises').then(({ readFile }) => readFile(resolve(work, 'raw/S-M06-02-qr-ueben.json'), 'utf8')))
const playerClick = playerEvents.events?.find((event) => event.label === 'Übung starten')
if (playerClick === undefined) throw new Error('Zeitpunkt des Player-Starts fehlt')
const playerSpeed = 1.05
const playerDelayMs = Math.round((217 + playerClick.seconds / playerSpeed) * 1000)
const playerAudioDurationSeconds = (235 - playerDelayMs / 1000) * playerSpeed
const output = resolve(outputDirectory, 'zupfnoter-ts-promotion-legacy-v6.mp4')
ffmpeg(['-i', silentVideo, '-i', resolve(work, 'audio/narration-v2.wav'), '-stream_loop', '-1', '-i', resolve(work, 'audio/krippen-demo-background.wav'), '-i', resolve(work, 'audio/promotion-clicks.wav'), '-i', resolve(work, 'audio/zupfnoter-playback.webm'),
  '-filter_complex', `[1:a]volume=1.03[narration];[2:a]volume='if(gt(between(t,187,210)+between(t,217,235),0),0,0.085)':eval=frame[music];[3:a]volume=0.42[clicks];[4:a]asplit=2[workbench-source][player-source];[workbench-source]atrim=end=${playbackDurationSeconds},asetpts=PTS-STARTPTS,volume=0.72,adelay=${playbackDelayMs}:all=1[workbench-playback];[player-source]atrim=end=${playerAudioDurationSeconds},asetpts=PTS-STARTPTS,atempo=${playerSpeed},volume=0.72,adelay=${playerDelayMs}:all=1[player-playback];[narration][music][clicks][workbench-playback][player-playback]amix=inputs=5:normalize=0:duration=longest,alimiter=limit=.95[audio]`,
  '-map', '0:v', '-map', '[audio]', '-t', '240', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output])

console.log(output)
