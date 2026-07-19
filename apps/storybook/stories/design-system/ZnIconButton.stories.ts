import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { ZnIcon, ZnIconButton } from '@zupfnoter/design-system'

const meta = {
  title: 'Design System/ZnIconButton',
  component: ZnIconButton,
  tags: ['autodocs'],
  argTypes: { variant: { control: 'select', options: ['primary', 'secondary', 'ghost'] } },
} satisfies Meta<typeof ZnIconButton>

export default meta
type Story = StoryObj<typeof meta>

export const Secondary: Story = { render: (args) => ({ components: { ZnIcon, ZnIconButton }, setup: () => ({ args }), template: '<ZnIconButton v-bind="args"><ZnIcon name="edit" /></ZnIconButton>' }), args: { label: 'Bearbeiten' } }
export const Disabled: Story = { render: (args) => ({ components: { ZnIcon, ZnIconButton }, setup: () => ({ args }), template: '<ZnIconButton v-bind="args"><ZnIcon name="delete" /></ZnIconButton>' }), args: { label: 'Löschen', disabled: true } }
