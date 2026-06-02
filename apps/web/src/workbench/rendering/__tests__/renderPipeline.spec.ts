import { describe, expect, it, vi } from 'vitest'

vi.mock('@zupfnoter/core', () => {
  class MockAbcParser {
    errors: Array<{ severity: number; message: string; line?: number }> = []

    renderSvg(): string {
      return '<svg width="10" height="5"></svg><svg width="20" height="8"></svg>'
    }

    parse(): Record<string, never> {
      return {}
    }
  }

  class MockAbcToSong {
    transform() {
      return { voices: [{ entities: [] }] }
    }
  }

  class MockConfstack {}

  class MockHarpnotesLayout {
    constructor(_config: unknown, _options: unknown) {}

    layout() {
      return { children: [] }
    }
  }

  class MockSvgEngine {
    draw(): string {
      return '<svg width="3" height="4"></svg>'
    }
  }

  return {
    AbcParser: MockAbcParser,
    AbcToSong: MockAbcToSong,
    Confstack: MockConfstack,
    HarpnotesLayout: MockHarpnotesLayout,
    SvgEngine: MockSvgEngine,
    createDefaultAnnotationTextMetrics: () => ({}),
    extractSongConfig: () => ({}),
    initConf: () => ({}),
    mergeSongConfig: () => ({}),
  }
})

import { renderWorkbenchPreviews } from '../renderPipeline'

describe('renderWorkbenchPreviews', () => {
  it('normalizes every svg block in the score preview', () => {
    const result = renderWorkbenchPreviews('X:1\nK:C\nC\n')

    expect(result.scoreSvg).toContain('<svg width="100%" height="auto"')
    expect(result.scoreSvg.match(/width="100%"/g)).toHaveLength(2)
    expect(result.harpSvg).toContain('<svg width="100%" height="auto"')
  })
})
