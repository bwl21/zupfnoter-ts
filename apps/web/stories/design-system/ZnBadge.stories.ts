import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ZnBadge from '../../src/design-system/components/ZnBadge.vue'

const meta = {
  title: 'Design System/ZnBadge',
  component: ZnBadge,
  tags: ['autodocs'],
  argTypes: {
    tone: { control: 'select', options: ['neutral', 'accent', 'success', 'warning', 'danger', 'info'] },
  },
} satisfies Meta<typeof ZnBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Neutral: Story = { args: { tone: 'neutral', default: 'Bereit' } }
export const StatusPalette: Story = {
  render: () => ({ components: { ZnBadge }, template: '<div style="display:flex;gap:.5rem;flex-wrap:wrap"><ZnBadge tone="accent">Aktiv</ZnBadge><ZnBadge tone="success">Verbunden</ZnBadge><ZnBadge tone="warning">Ungespeichert</ZnBadge><ZnBadge tone="danger">Fehler</ZnBadge><ZnBadge tone="info">Hinweis</ZnBadge></div>' }),
}

