import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { ZnIcon, ZN_ICONS, type ZnIconName } from '@zupfnoter/design-system'

const iconNames = Object.keys(ZN_ICONS) as ZnIconName[]
const meta = {
  title: 'Design System/ZnIcon',
  component: ZnIcon,
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'Einheitliche Darstellung eines registrierten Font-Awesome-Symbols. Die Symbolauswahl ist über `name` auf die zentrale Icon-Palette begrenzt.' } } },
  args: { name: 'edit' },
  argTypes: { name: { control: 'select', options: iconNames } },
} satisfies Meta<typeof ZnIcon>

export default meta
type Story = StoryObj<typeof meta>

export const Edit: Story = { args: { name: 'edit' } }
export const IconPalette: Story = {
  render: () => ({ components: { ZnIcon }, setup: () => ({ iconNames }), template: '<div style="display:flex;gap:1rem;flex-wrap:wrap"><span v-for="name in iconNames" :key="name" style="display:grid;justify-items:center;gap:.25rem"><ZnIcon :name="name" /><small>{{ name }}</small></span></div>' }),
}
