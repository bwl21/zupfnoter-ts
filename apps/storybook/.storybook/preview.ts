import type { Preview } from '@storybook/vue3-vite'
import '@zupfnoter/design-system/tokens.css'

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
