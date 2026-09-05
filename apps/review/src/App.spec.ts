import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ReviewDocument } from '@zupfnoter/types'

import App from './App.vue'

const reviewDocument: ReviewDocument = {
  title: 'Review-Test',
  extractNumber: 0,
  extracts: [{ number: 0, title: 'Alle Stimmen' }],
  scoreSvg: '<svg aria-label="score"><rect data-start-char="0" data-end-char="1" /></svg>',
  harpSvg: '<svg aria-label="harp"><rect data-zn-id="n1" /></svg>',
  playbackTimeline: [],
  baseTempoBpm: 120,
  tempoUnit: 0.25,
}

vi.mock('@zupfnoter/core', () => ({
  renderReviewDocument: vi.fn(() => reviewDocument),
}))

const stop = vi.fn()
vi.mock('@zupfnoter/playback-audio', () => ({
  useAudioPlayer: vi.fn(() => ({
    schedule: vi.fn(),
    stop,
    suspend: vi.fn(),
    resume: vi.fn(),
  })),
}))

describe('Review App', () => {
  beforeEach(() => {
    stop.mockClear()
  })

  it('starts with the harp view and switches to normal notation', async () => {
    const wrapper = mount(App)

    expect(wrapper.get('h1').text()).toBe('Review-Test')
    expect(wrapper.get('[aria-label="Harfennoten"]').html()).toContain('aria-label="harp"')

    await wrapper.get('[data-testid="score-view"]').trigger('click')

    expect(wrapper.get('[aria-label="Noten"]').html()).toContain('aria-label="score"')
    wrapper.unmount()
    expect(stop).toHaveBeenCalled()
  })
})
