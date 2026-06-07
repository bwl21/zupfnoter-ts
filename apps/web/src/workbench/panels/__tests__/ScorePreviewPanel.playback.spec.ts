import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import ScorePreviewPanel from '../ScorePreviewPanel.vue'

describe('ScorePreviewPanel playback highlighting', () => {
  it('marks highlighted SVG nodes from playback events', async () => {
    const wrapper = mount(ScorePreviewPanel, {
      props: {
        svg: '<svg width="120" height="60"><g data-start-char="7" data-end-char="11"><rect width="10" height="10" /></g></svg>',
        playbackTextRange: {
          startpos: 7,
          endpos: 11,
        },
      },
    })

    await nextTick()
    await nextTick()

    expect(wrapper.find('[data-start-char="7"]').classes()).toContain('zn-playback-highlight')
  })

  it('marks selected SVG nodes separately from playback', async () => {
    const wrapper = mount(ScorePreviewPanel, {
      props: {
        svg: '<svg width="120" height="60"><g data-start-char="7" data-end-char="11"><rect width="10" height="10" /></g></svg>',
        selectedTextRange: {
          startpos: 7,
          endpos: 11,
        },
      },
    })

    await nextTick()
    await nextTick()

    expect(wrapper.find('[data-start-char="7"]').classes()).toContain('zn-selection-highlight')
  })
})
