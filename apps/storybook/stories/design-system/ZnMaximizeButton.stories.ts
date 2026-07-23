import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { ZnMaximizeButton } from '@zupfnoter/design-system'

const meta = {
  title: 'Design System/ZnMaximizeButton',
  component: ZnMaximizeButton,
  tags: ['autodocs'],
  argTypes: {
    maximized: { control: 'boolean' },
  },
} satisfies Meta<typeof ZnMaximizeButton>

export default meta
type Story = StoryObj<typeof meta>

export const Restored: Story = {
  args: {
    maximized: false,
  },
}

export const Maximized: Story = {
  args: {
    maximized: true,
  },
}
