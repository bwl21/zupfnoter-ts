import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderReviewDocument } from '@zupfnoter/core'
import type { PlaybackScheduleCallbacks } from '@zupfnoter/playback-audio'
import type { PlaybackStep, ReviewDocument } from '@zupfnoter/types'

import App from './App.vue'

const playbackStep: PlaybackStep = {
  originVoiceIds: ['1'],
  originPlaybackIds: ['1::n1'],
  originZnIds: ['n1'],
  activeTextRanges: [{ startpos: 0, endpos: 1 }],
  activePlaybackTextRanges: [
    { playbackId: '1::n1', voiceId: '1', textRange: { startpos: 0, endpos: 1 } },
  ],
  activeNotes: [
    {
      originVoiceId: '1',
      originPlaybackId: '1::n1',
      originZnId: 'n1',
      pitch: 60,
      durationMs: 500,
      attack: true,
      pan: 'left',
    },
  ],
  activeTime: '0',
  playbackStartMs: 0,
  durationMs: 100,
  sourceTime: 0,
  position: { measureNumber: 1, passIndex: 1 },
  meter: { numerator: 4, denominator: 4 },
  flowIndex: 0,
  passIndex: 1,
}

const reviewDocument: ReviewDocument = {
  title: 'Review-Test',
  extractNumber: 0,
  extracts: [
    { number: 0, title: 'Alle Stimmen' },
    { number: 1, title: 'Melodie' },
  ],
  scoreSvg:
    '<svg aria-label="score"><rect class="zn-score-hitbox" data-start-char="0" data-end-char="1" /></svg>',
  harpSvg:
    '<svg aria-label="harp"><rect class="zupfnoter-hitbox" data-start-char="0" data-end-char="1" data-zn-id="n1" /></svg>',
  playbackTimeline: [playbackStep],
  playbackConfig: undefined,
  baseTempoBpm: 120,
  tempoUnit: 0.25,
}

vi.mock('@zupfnoter/core', async (importOriginal) => ({
  ...await importOriginal<typeof import('@zupfnoter/core')>(),
  renderReviewDocument: vi.fn(() => reviewDocument),
  updateActivePlaybackRanges: vi.fn(
    (_ranges: ReadonlyMap<string, unknown>, step: PlaybackStep) =>
      new Map([
        [
          '1::n1:0:1',
          {
            textRange: step.activeTextRanges[0],
            endTimeMs: 500,
          },
        ],
      ]),
  ),
  expireActivePlaybackRanges: vi.fn(
    (ranges: ReadonlyMap<string, { endTimeMs: number }>, playbackTimeMs: number) =>
      new Map([...ranges].filter(([, range]) => range.endTimeMs > playbackTimeMs)),
  ),
}))

const stop = vi.fn()
let playbackCallbacks: PlaybackScheduleCallbacks | undefined
vi.mock('@zupfnoter/playback-audio', () => ({
  useAudioPlayer: vi.fn(() => ({
    schedule: vi.fn(async (_steps, _speed, callbacks: PlaybackScheduleCallbacks) => {
      playbackCallbacks = callbacks
      callbacks.onStepStart?.(playbackStep)
    }),
    stop,
    suspend: vi.fn(),
    resume: vi.fn(),
  })),
}))

describe('Review App', () => {
  beforeEach(() => {
    stop.mockClear()
    playbackCallbacks = undefined
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key)),
      clear: vi.fn(() => values.clear()),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts with the harp view and switches to normal notation', async () => {
    const wrapper = mount(App)
    await nextTick()

    expect(wrapper.find('h1').exists()).toBe(false)
    expect(wrapper.get('.review-brand').text()).toContain('Zupfnoter Review')
    expect(wrapper.get('[aria-label="Harfennoten"]').html()).toContain('aria-label="harp"')

    await wrapper.get('.extract-picker__summary').trigger('click')
    expect(wrapper.get('.extract-picker__menu').text()).toContain('1 Melodie')
    await wrapper.get('.extract-picker__item:nth-child(2)').trigger('click')
    await nextTick()
    expect(vi.mocked(renderReviewDocument)).toHaveBeenLastCalledWith(expect.any(String), 1)

    await wrapper.get('[data-testid="score-view"]').trigger('click')

    expect(wrapper.get('[aria-label="Noten"]').html()).toContain('aria-label="score"')

    expect(wrapper.findAll('.review-actions > button')).toHaveLength(1)
    expect(wrapper.get('[data-testid="open-storage"]').attributes('aria-label')).toBe('Öffnen')
    expect(wrapper.get('[aria-label="Starttakt"]').element).toBeInstanceOf(HTMLInputElement)
    expect(wrapper.get('[aria-label="Startdurchlauf"]').element).toBeInstanceOf(HTMLInputElement)
    expect(wrapper.get('[aria-label="Metronom-Modus"]').element).toBeInstanceOf(HTMLSelectElement)
    expect(wrapper.get('[aria-label="Takt 1 · Durchlauf 1"]').element).toBeInstanceOf(HTMLElement)
    await wrapper.get('[data-testid="open-storage"]').trigger('click')
    const storageDialog = document.body.querySelector('[aria-labelledby="storage-title"]')
    expect(storageDialog?.textContent).toContain('Stück öffnen')
    expect(storageDialog?.textContent).toContain('Von diesem Gerät')

    const manageStorage = document.body.querySelector('[data-testid="manage-storage"]')
    expect(manageStorage).toBeInstanceOf(HTMLButtonElement)
    manageStorage?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(storageDialog?.textContent).toContain('Speicherverbindungen')
    expect(storageDialog?.textContent).toContain('Dropbox verbinden')
    wrapper.unmount()
    expect(stop).toHaveBeenCalled()
  })

  it('uses the web playback class until the shared note-off expires it', async () => {
    const wrapper = mount(App)
    await nextTick()
    const scrollIntoView = vi.fn()
    wrapper.get('.zupfnoter-hitbox').element.scrollIntoView = scrollIntoView

    await wrapper.get('.review-play').trigger('click')
    await nextTick()
    expect(wrapper.get('.zupfnoter-hitbox').classes()).toContain('zn-playback-highlight')
    expect(scrollIntoView).not.toHaveBeenCalled()

    playbackCallbacks?.onMetronomeBeat?.({ beat: 2, division: 4, accent: false })
    await nextTick()
    expect(wrapper.findAll('.playback-status-overlay__beat')).toHaveLength(4)
    expect(wrapper.get('.playback-status-overlay__beat--active')).toBeDefined()

    playbackCallbacks?.onNoteOff?.(500)
    await nextTick()
    await nextTick()
    expect(wrapper.get('.zupfnoter-hitbox').classes()).not.toContain('zn-playback-highlight')
    wrapper.unmount()
  })
})
