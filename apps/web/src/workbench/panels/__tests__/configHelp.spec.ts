import { describe, expect, it } from 'vitest'

import { loadConfigHelpTexts, resolveConfigHelpHtml } from '../configHelp'

describe('configHelp', () => {
  it('resolves help for dynamic minc fields from generated documentation', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => new Response(JSON.stringify({
      'minc\\_f': '<p>Minc help</p>',
    }), { status: 200 })

    try {
      const helpTexts = await loadConfigHelpTexts()
      expect(resolveConfigHelpHtml('extract.0.notebound.minc.4224.minc_f', helpTexts))
        .toBe('<p>Minc help</p>')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
