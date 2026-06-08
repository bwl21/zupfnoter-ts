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

  test('keeps editor text selection out of the harp preview object highlight', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.cm-content')
    await page.waitForTimeout(1000)

    await setEditorSelection(page, 287, 289)

    await expect.poll(async () => (
      page.locator('.preview-stage__svg .zn-selection-highlight-range').count()
    )).toBeGreaterThan(0)

    await expect(page.locator('.harp-preview__svg .zn-selection-highlight')).toHaveCount(0)
  })
})
