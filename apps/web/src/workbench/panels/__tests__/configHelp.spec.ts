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

  it('resolves playback help through extract inheritance candidates', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => new Response(JSON.stringify({
      'playback.metronomeMode': '<p>Metronom-Modus</p>',
      'playback.subdivision': '<p>Positive ganze Zahl</p>',
    }), { status: 200 })

    try {
      const helpTexts = await loadConfigHelpTexts()
      expect(resolveConfigHelpHtml('extract.3.playback.metronomeMode', helpTexts))
        .toContain('Metronom-Modus')
      expect(resolveConfigHelpHtml('extract.3.playback.subdivision', helpTexts))
        .toContain('Positive ganze Zahl')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
