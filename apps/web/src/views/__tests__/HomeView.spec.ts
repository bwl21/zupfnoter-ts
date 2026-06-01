import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import HomeView from '../HomeView.vue'

describe('HomeView', () => {
  it('renders the Zupfnoter workbench shell', () => {
    const wrapper = mount(HomeView)

    expect(wrapper.text()).toContain('Zupfnoter Workbench')
    expect(wrapper.text()).toContain('ABC-Notation')
    expect(wrapper.text()).toContain('Pdf-Vorschau')
    expect(wrapper.text()).not.toContain('Console')
    expect(wrapper.text()).toContain('Extract 0')
  })
})
