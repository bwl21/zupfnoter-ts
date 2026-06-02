import { expect, test } from '@playwright/test'

test.describe('Zupfnoter workbench', () => {
  test('renders the demonstrator panes without document scrolling', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('textbox', { name: 'ABC notation editor' })).toHaveValue(/T:Zupfnoter Demonstrator/)
    await expect(page.locator('.preview-stage__svg svg').first()).toBeVisible()
    await expect(page.locator('.harp-preview__svg svg').first()).toBeVisible()

    const documentScrolls = await page.evaluate(() => {
      const root = document.documentElement
      return root.scrollHeight > root.clientHeight || document.body.scrollHeight > document.body.clientHeight
    })

    expect(documentScrolls).toBe(false)
  })
})
