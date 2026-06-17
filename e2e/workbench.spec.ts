import { expect, test, type Page } from '@playwright/test'

async function setEditorSelection(
  page: Page,
  start: number,
  end: number,
): Promise<void> {
  const applied = await page.evaluate(({ startpos, endpos }) => {
    const content = document.querySelector('.cm-content') as
      | { cmTile?: { view?: { dispatch: (spec: unknown) => void } } }
      | null
    const view = content?.cmTile?.view
    if (view === undefined) return false

    view.dispatch({
      selection: {
        anchor: startpos,
        head: endpos,
      },
      scrollIntoView: true,
    })

    return true
  }, { startpos: start, endpos: end })

  expect(applied).toBe(true)
}

test.describe('Zupfnoter workbench', () => {
  test('renders the demonstrator panes without document scrolling', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('textbox', { name: 'ABC notation editor' })).toContainText('T:Zupfnoter Reference Sheet')
    await expect(page.locator('.preview-stage__svg svg').first()).toBeVisible()
    await expect(page.locator('.harp-preview__svg svg').first()).toBeVisible()

    const documentScrolls = await page.evaluate(() => {
      const root = document.documentElement
      return root.scrollHeight > root.clientHeight || document.body.scrollHeight > document.body.clientHeight
    })

    expect(documentScrolls).toBe(false)
  })

  test('projects editor text selection into the harp preview highlight', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.cm-content')
    await page.waitForTimeout(1000)

    await setEditorSelection(page, 287, 289)

    await expect.poll(async () => (
      page.locator('.preview-stage__svg .zn-selection-highlight-range').count()
    )).toBeGreaterThan(0)

    await expect.poll(async () => (
      page.locator('.harp-preview__svg .zn-selection-highlight').count()
    )).toBeGreaterThan(0)
  })

  test('shows the about dialog with build metadata', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'About this build' }).click()

    const dialog = page.locator('dialog[open]')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('About Zupfnoter')
    await expect(dialog).toContainText('Web 0.1.0')
    await expect(dialog).toContainText('abc123def456')
    await expect(dialog).toContainText('17.06.2026')
  })
})
