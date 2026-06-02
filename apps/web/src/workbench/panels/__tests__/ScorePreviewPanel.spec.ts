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
})
