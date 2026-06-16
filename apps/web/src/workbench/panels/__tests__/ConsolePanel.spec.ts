import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ConsolePanel from '../ConsolePanel.vue'

describe('ConsolePanel', () => {
  it('shows an activity badge in the header', () => {
    const wrapper = mount(ConsolePanel, {
      props: {
        lines: [],
        busy: true,
        activityLabel: 'Aktivität: läuft',
        resolveCommand: () => undefined,
        getCommand: () => undefined,
      },
    })

    expect(wrapper.text()).toContain('Aktivität: läuft')
  })
})
