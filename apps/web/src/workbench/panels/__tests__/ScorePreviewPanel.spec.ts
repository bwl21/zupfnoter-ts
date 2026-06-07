import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ScorePreviewPanel from '../ScorePreviewPanel.vue'

describe('ScorePreviewPanel', () => {
  it('renders the score svg without zoom controls', () => {
    const wrapper = mount(ScorePreviewPanel, {
      props: {
        svg: '<svg width="200" height="100" viewBox="0 0 200 100"></svg>',
      },
    })

    expect(wrapper.find('.preview-stage__svg svg').exists()).toBe(true)
    expect(wrapper.find('.zn-zoom-control').exists()).toBe(false)
  })

  it('emits selected znId clicks from the injected svg', async () => {
    const wrapper = mount(ScorePreviewPanel, {
      props: {
        svg: '<svg width="40" height="20"><g data-start-char="12" data-end-char="18"><rect width="10" height="10" /></g></svg>',
      },
    })

    await wrapper.find('.preview-stage__svg rect').trigger('click')

    expect(wrapper.emitted('select-text-range')).toEqual([
      [{ startpos: 12, endpos: 18, extend: false, source: 'score-preview' }],
    ])
  })
})
