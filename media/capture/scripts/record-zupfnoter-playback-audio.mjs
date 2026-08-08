import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDirectory, '../../..')
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4180'
const outputDirectory = resolve(root, 'media-work/audio')
const demoAbc = (await readFile(resolve(root, 'fixtures/cases/public/krippen-demo/input.abc'), 'utf8'))
  .replace('Q:1/4=80.00', 'Q:1/4=80')

await mkdir(outputDirectory, { recursive: true })

const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] })
const context = await browser.newContext({ locale: 'de-DE' })
await context.addInitScript(({ abc }) => {
  localStorage.setItem('zupfnoter.abc.current', abc)
  localStorage.setItem('zupfnoter.playback.instrument', 'oscillator')
}, { abc: demoAbc })

await context.addInitScript(() => {
  const NativeAudioContext = window.AudioContext ?? window.webkitAudioContext
  if (NativeAudioContext === undefined || window.MediaRecorder === undefined) return

  const captures = []
  const originalCreateGain = NativeAudioContext.prototype.createGain
  const originalConnect = AudioNode.prototype.connect

  NativeAudioContext.prototype.createGain = function createGain() {
    if (this.__zupfnoterCapture === undefined) {
      const destination = this.createMediaStreamDestination()
      const chunks = []
      const recorder = new MediaRecorder(destination.stream, { mimeType: 'audio/webm;codecs=opus' })
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      })
      recorder.start(200)
      this.__zupfnoterCapture = destination
      captures.push({ recorder, chunks })
    }
    return originalCreateGain.call(this)
  }

  AudioNode.prototype.connect = function connect(destination, ...args) {
    const result = originalConnect.call(this, destination, ...args)
    const captureDestination = this.context?.__zupfnoterCapture
    if (captureDestination !== undefined && destination === this.context.destination) {
      originalConnect.call(this, captureDestination)
    }
    return result
  }

  window.__zupfnoterFinishCapture = async () => {
    const results = []
    for (const capture of captures) {
      await new Promise((finish) => {
        capture.recorder.addEventListener('stop', finish, { once: true })
        capture.recorder.stop()
      })
      const blob = new Blob(capture.chunks, { type: 'audio/webm;codecs=opus' })
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let binary = ''
      for (let offset = 0; offset < bytes.length; offset += 32768) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768))
      }
      results.push({ size: bytes.length, base64: btoa(binary) })
    }
    return results
  }
})

try {
  const page = await context.newPage()
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.getByRole('textbox', { name: 'ABC notation editor' }).waitFor()
  await page.waitForFunction(() => document.body.textContent?.includes('Ich steh an deiner Krippen hier'))
  await page.getByText('Rendered', { exact: true }).waitFor()
  await page.waitForTimeout(1600)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.waitForTimeout(19500)
  const captures = await page.evaluate(() => window.__zupfnoterFinishCapture?.() ?? [])
  const capture = captures.sort((left, right) => right.size - left.size)[0]
  if (capture === undefined || capture.size < 1000) throw new Error('Zupfnoter-Wiedergabe konnte nicht aufgenommen werden')
  const output = resolve(outputDirectory, 'zupfnoter-playback.webm')
  await writeFile(output, Buffer.from(capture.base64, 'base64'))
  console.log(output)
} finally {
  await context.close()
  await browser.close()
}
