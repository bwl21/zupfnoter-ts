import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { ZnZoomControl } from '@zupfnoter/design-system'

const meta = {
  title: 'Design System/ZnZoomControl',
  component: ZnZoomControl,
  tags: ['autodocs'],
  argTypes: {
    modelValue: {
      control: { type: 'number', min: 25, max: 400, step: 5 },
    },
  },
} satisfies Meta<typeof ZnZoomControl>

export default meta
type Story = StoryObj<typeof meta>

export const Standard: Story = {
  args: {
    modelValue: 100,
  },
}

export const EnlargedPreview: Story = {
  args: {
    modelValue: 175,
  },
}

export const NarrowRange: Story = {
  args: {
    modelValue: 80,
    min: 50,
    max: 150,
    step: 5,
  },
}
