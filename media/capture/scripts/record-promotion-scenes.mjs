import { readFile, rename, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '../../..')
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4180'
const playerBaseUrl = process.env.PLAYER_BASE_URL ?? 'http://127.0.0.1:4181'
const outputDirectory = resolve(repositoryRoot, 'media-work/raw')
const demoAbc = (await readFile(resolve(repositoryRoot, 'fixtures/cases/public/krippen-demo/input.abc'), 'utf8'))
  .replace('Q:1/4=80.00', 'Q:1/4=80')
const clickFeedbackPath = resolve(scriptDirectory, 'click-feedback.js')

await mkdir(outputDirectory, { recursive: true })

const browser = await chromium.launch({ headless: true })
const recordings = []
const requestedScenes = new Set((process.env.SCENES ?? '').split(',').map((value) => value.trim()).filter(Boolean))

function demoConnections() {
  return [
    {
      id: 'capture-private',
      providerId: 'dropbox',
      label: 'Privat',
      rootPath: 'Zupfnoter/Privat',
      relativePath: '',
      readOnly: false,
      configuration: {},
      status: 'disconnected',
    },
    {
      id: 'capture-club',
      providerId: 'dropbox',
      label: 'Gruppe',
      rootPath: 'Zupfnoter/Gruppe',
      relativePath: '',
      readOnly: false,
      configuration: {},
      status: 'disconnected',
    },
    {
      id: 'capture-archive',
      providerId: 'dropbox',
      label: 'Archiv',
      rootPath: 'Zupfnoter/Archiv',
      relativePath: '',
      readOnly: true,
      configuration: {},
      status: 'disconnected',
    },
  ]
}

async function installDemoState(context, { connections = false, oscillator = false } = {}) {
  await context.addInitScript(({ abc, storageConnections, useOscillator }) => {
    localStorage.setItem('zupfnoter.abc.current', abc)
    if (storageConnections !== undefined) {
      localStorage.setItem('zupfnoter.storage.connections', JSON.stringify(storageConnections))
    }
    if (useOscillator) {
      localStorage.setItem('zupfnoter.playback.instrument', 'oscillator')
    }
  }, {
    abc: demoAbc,
    storageConnections: connections ? demoConnections() : undefined,
    useOscillator: oscillator,
  })
}

async function moveAndClick(page, locator, label, events, startedAt) {
  await locator.scrollIntoViewIfNeeded()
  await locator.hover()
  await page.waitForTimeout(450)
  events.push({ type: 'click', label, seconds: (Date.now() - startedAt) / 1000 })
  await locator.click()
  await page.waitForTimeout(650)
}

async function maximizeAndFitHarp(page, events, startedAt) {
  await moveAndClick(
    page,
    page.getByRole('button', { name: 'Harfenpanel maximieren' }),
    'Harfennoten maximieren',
    events,
    startedAt,
  )
  await moveAndClick(page, page.getByText('eingepasst', { exact: true }), 'Ganzes Blatt einpassen', events, startedAt)
  await page.waitForTimeout(1800)
}

async function recordScene(id, options, action) {
  const sceneDirectory = join(outputDirectory, id)
  await mkdir(sceneDirectory, { recursive: true })
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'de-DE',
    recordVideo: { dir: sceneDirectory, size: { width: 1600, height: 900 } },
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  await context.addInitScript({ path: clickFeedbackPath })
  if (options.demo) {
    await installDemoState(context, options)
  }

  const page = await context.newPage()
  const video = page.video()
  const startedAt = Date.now()
  const events = []
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  if (options.demo) {
    await page.getByRole('textbox', { name: 'ABC notation editor' }).waitFor()
    await page.waitForFunction(() => document.body.textContent?.includes('Ich steh an deiner Krippen hier'))
  } else {
    await page.getByTestId('welcome-start-page').waitFor()
  }
  const readySeconds = (Date.now() - startedAt) / 1000
  await page.waitForTimeout(1200)
  await action(page, events, startedAt)
  await page.waitForTimeout(1500)

  await context.close()
  if (video === null) throw new Error(`Keine Videoaufnahme für ${id}`)
  const temporaryPath = await video.path()
  const finalPath = join(outputDirectory, `${id}.webm`)
  await rename(temporaryPath, finalPath)
  await writeFile(join(outputDirectory, `${id}.json`), `${JSON.stringify({
    id,
    readySeconds,
    events,
  }, null, 2)}\n`)
  recordings.push(finalPath)
}

async function maybeRecordScene(id, options, action) {
  if (requestedScenes.size > 0 && !requestedScenes.has(id)) return
  await recordScene(id, options, action)
}

try {
  await maybeRecordScene('S-M01-01-warum-zupfnoter-ts', { demo: false }, async (page, events, startedAt) => {
    await page.waitForTimeout(1800)
    await moveAndClick(
      page,
      page.getByRole('button', { name: /Beispielstück öffnen/ }),
      'Beispielstück öffnen',
      events,
      startedAt,
    )
    await page.getByRole('textbox', { name: 'ABC notation editor' }).waitFor()
    await page.waitForTimeout(5000)
  })

  await maybeRecordScene('S-M02-03-vertrauter-arbeitsplatz', { demo: true }, async (page) => {
    const editor = page.getByRole('textbox', { name: 'ABC notation editor' })
    await editor.hover()
    await page.waitForTimeout(2200)
    const score = page.locator('.score-preview')
    if (await score.count() > 0) {
      await score.hover()
      await page.waitForTimeout(2600)
    }
    await maximizeAndFitHarp(page, [], Date.now())
    await page.locator('.harp-preview__svg').hover()
    await page.waitForTimeout(5200)
  })

  await maybeRecordScene('S-M03-01-speicherorte', { demo: true, connections: true }, async (page, events, startedAt) => {
    await moveAndClick(page, page.getByText('Kein Speicherziel', { exact: true }), 'Speicherverbindungen', events, startedAt)
    await page.getByRole('heading', { name: 'Speicherverbindungen' }).waitFor()
    await page.waitForTimeout(3000)
    await page.getByRole('textbox', { name: 'Name der Verbindung Gruppe' }).hover()
    await page.waitForTimeout(2200)
    const archiveRow = page.locator('tr').filter({ has: page.getByRole('textbox', { name: 'Name der Verbindung Archiv' }) })
    await archiveRow.hover()
    await page.waitForTimeout(3200)
  })

  await maybeRecordScene('S-M04-01-geschwindigkeit', { demo: true }, async (page, events, startedAt) => {
    await moveAndClick(page, page.getByTestId('view-menu-toggle'), 'Ansicht öffnen', events, startedAt)
    await moveAndClick(page, page.getByRole('menuitem', { name: 'Harfeneingabe' }), 'Harfeneingabe wählen', events, startedAt)
    await moveAndClick(page, page.getByText('eingepasst', { exact: true }), 'Ganzes Harfenblatt einpassen', events, startedAt)
    const line = page.locator('.cm-line').filter({ hasText: 'T:Ich steh an deiner Krippen hier' })
    await moveAndClick(page, line, 'Titelzeile auswählen', events, startedAt)
    await page.keyboard.press('End')
    await page.keyboard.type(' – sofort aktualisiert')
    await page.locator('.harp-preview__svg').hover()
    await page.waitForTimeout(4400)
    await line.click()
    await page.keyboard.press('End')
    await page.keyboard.press('ControlOrMeta+z')
    await page.locator('.harp-preview__svg').hover()
    await page.waitForTimeout(4200)
  })

  await maybeRecordScene('S-M04-02-auswahlumfang', { demo: true }, async (page, events, startedAt) => {
    const line = page.locator('.cm-line').filter({ hasText: 'G | G/A/ B A G' }).first()
    await moveAndClick(page, line, 'Passage auswählen', events, startedAt)
    await page.keyboard.press('Home')
    for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowRight')
    for (let index = 0; index < 14; index += 1) await page.keyboard.press('Shift+ArrowRight')
    await page.waitForTimeout(3200)
    const scope = page.locator('.footer-bar__scope-select')
    await scope.hover()
    events.push({ type: 'click', label: 'Auswahl auf Auszug', seconds: (Date.now() - startedAt) / 1000 })
    await scope.click()
    await scope.selectOption('extract-voices')
    await page.waitForTimeout(2400)
    events.push({ type: 'click', label: 'Auswahl auf alle Stimmen', seconds: (Date.now() - startedAt) / 1000 })
    await scope.click()
    await scope.selectOption('all-voices')
    await page.waitForTimeout(2600)
    await maximizeAndFitHarp(page, events, startedAt)
    await page.waitForTimeout(3600)
  })

  await maybeRecordScene('S-M05-01-konfiguration', { demo: true }, async (page, events, startedAt) => {
    await moveAndClick(page, page.getByTestId('view-menu-toggle'), 'Ansicht öffnen', events, startedAt)
    await moveAndClick(page, page.getByRole('menuitem', { name: 'Harfeneingabe' }), 'Harfeneingabe wählen', events, startedAt)
    const configurableObject = page.locator('.harp-preview__svg .zupfnoter-element[data-conf-key]:visible .zupfnoter-hitbox:visible').first()
    await configurableObject.scrollIntoViewIfNeeded()
    await configurableObject.hover()
    await page.waitForTimeout(900)
    events.push({ type: 'click', label: 'Harfenobjekt öffnen', seconds: (Date.now() - startedAt) / 1000 })
    await configurableObject.click({ button: 'right' })
    await page.waitForTimeout(1600)
    await moveAndClick(
      page,
      page.getByRole('menuitem', { name: /Konfiguration bearbeiten/ }),
      'Konfiguration des Objekts öffnen',
      events,
      startedAt,
    )
    await page.waitForTimeout(2800)
    const parameter = page.locator('.config-row--leaf').filter({ hasText: 'Verschiebung' }).first().locator('.config-row__name')
    await moveAndClick(page, parameter, 'Parameter auswählen', events, startedAt)
    await page.waitForTimeout(5200)
    await page.locator('.harp-preview__svg').hover()
    await page.waitForTimeout(3800)
  })

  await maybeRecordScene('S-M06-01-musikalische-wiedergabe', { demo: true, oscillator: true }, async (page, events, startedAt) => {
    await maximizeAndFitHarp(page, events, startedAt)
    await moveAndClick(page, page.getByRole('button', { name: 'Play', exact: true }), 'Wiedergabe starten', events, startedAt)
    await page.waitForTimeout(19000)
    const stop = page.getByRole('button', { name: 'Stop', exact: true })
    if (await stop.count() > 0) {
      await moveAndClick(page, stop, 'Wiedergabe stoppen', events, startedAt)
    }
  })

  await maybeRecordScene('S-M06-02-qr-ueben', { demo: true }, async (page, events, startedAt) => {
    await moveAndClick(page, page.getByRole('button', { name: 'Playback-Link teilen' }), 'Playback-Link erzeugen', events, startedAt)
    await page.getByText('Playback-Link', { exact: true }).waitFor()
    await page.waitForTimeout(2600)
    const playbackLink = await page.evaluate(() => navigator.clipboard.readText())
    const encodedUrl = new URL(playbackLink)
    const localPlayerUrl = new URL(playerBaseUrl)
    localPlayerUrl.search = encodedUrl.search
    localPlayerUrl.hash = encodedUrl.hash
    await page.goto(localPlayerUrl.toString(), { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Zupfnoter Übung' }).waitFor()
    await page.waitForTimeout(2600)
    await moveAndClick(page, page.getByText('Metronom', { exact: true }).locator('..').getByRole('checkbox'), 'Metronom einschalten', events, startedAt)
    const playButton = page.getByRole('button', { name: 'Wiedergabe starten' })
    await moveAndClick(page, playButton, 'Übung starten', events, startedAt)
    await page.waitForTimeout(9000)
  })
} finally {
  await browser.close()
}

console.log(recordings.join('\n'))
