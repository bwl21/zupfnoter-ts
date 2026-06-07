import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import ScorePreviewPanel from '../ScorePreviewPanel.vue'

describe('ScorePreviewPanel playback highlighting', () => {
  it('marks highlighted SVG nodes from playback events', async () => {
    const wrapper = mount(ScorePreviewPanel, {
      props: {
        svg: '<svg width="120" height="60"><g data-zn-id="note-1"><rect width="10" height="10" /></g></svg>',
        playbackHighlight: {
          activeZnIds: ['note-1'],
        },
      },
    })

    await nextTick()
    await nextTick()

    expect(wrapper.find('[data-zn-id="note-1"]').classes()).toContain('zn-playback-highlight')
  })

  it('marks selected SVG nodes separately from playback', async () => {
    const wrapper = mount(ScorePreviewPanel, {
      props: {
        svg: '<svg width="120" height="60"><g data-zn-id="note-1"><rect width="10" height="10" /></g></svg>',
        selectedZnIds: ['note-1'],
      },
    })

    await nextTick()
    await nextTick()

    expect(wrapper.find('[data-zn-id="note-1"]').classes()).toContain('zn-selection-highlight')
  })
})
