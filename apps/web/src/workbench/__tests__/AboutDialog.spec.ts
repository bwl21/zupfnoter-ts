import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AboutDialog from '../AboutDialog.vue'

describe('AboutDialog', () => {
  it('renders build metadata when open', () => {
    const wrapper = mount(AboutDialog, {
      attachTo: document.body,
      global: {
        stubs: {
          teleport: false,
        },
      },
      props: {
        open: true,
        appVersion: 'Web 0.1.0',
        commitHash: 'abc123def456',
        buildTime: '2026-06-17T06:00:00.000Z',
      },
    })

    expect(document.body.textContent ?? '').toContain('About Zupfnoter')
    expect(document.body.textContent ?? '').toContain('Web 0.1.0')
    expect(document.body.textContent ?? '').toContain('abc123def456')
    expect(document.body.textContent ?? '').toContain('17.06.2026')
    expect(document.body.textContent ?? '').toContain('08:00:00')

    wrapper.unmount()
  })
})
