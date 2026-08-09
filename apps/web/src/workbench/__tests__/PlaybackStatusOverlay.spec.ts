import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PlaybackStatusOverlay from '../PlaybackStatusOverlay.vue'

describe('PlaybackStatusOverlay', () => {
  it('matches the player position format and shows the active metronome beat', () => {
    const wrapper = mount(PlaybackStatusOverlay, {
      props: {
        partName: 'Teil A mit einem sehr langen Abschnittsnamen',
        measureNumber: 15,
        passIndex: 2,
        metronomeBeat: { beat: 3, division: 4, accent: false, pulse: 1 },
      },
    })

    expect(wrapper.attributes('aria-label')).toBe(
      'Abschnitt Teil A mit einem sehr langen Abschnittsnamen · Takt 15 · Durchlauf 2',
    )
    expect(wrapper.get('.playback-status-overlay__label').text()).toBe('Abschnitt · Takt · Durchlauf')
    expect(wrapper.get('.playback-status-overlay__measure').text()).toBe('| 15 |')
    expect(wrapper.get('.playback-status-overlay__pass').text()).toBe('#2')
    expect(wrapper.get('.playback-status-overlay__part-ellipsis').text()).toBe('…')
    expect(wrapper.findAll('.playback-status-overlay__beat')).toHaveLength(4)
    expect(wrapper.findAll('.playback-status-overlay__beat--active')).toHaveLength(1)
  })
})
