import { setup } from '@storybook/vue3-vite'
import type { Preview } from '@storybook/vue3-vite'
import { createPinia } from 'pinia'

import '../../web/src/assets/main.css'

setup((app) => {
  app.use(createPinia())
})

const preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo',
    },
    layout: 'padded',
  },
} satisfies Preview

export default preview
