import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { ZnButton } from '@zupfnoter/design-system'

const meta = {
  title: 'Design System/ZnButton',
  component: ZnButton,
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'Standardaktion für die Workbench und wiederverwendbare Oberflächen. `variant` beschreibt die Wichtigkeit der Aktion; deaktivierte Buttons bleiben sichtbar, sind aber nicht ausführbar.' } } },
  args: {
    default: 'Speichern',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger'],
    },
  },
} satisfies Meta<typeof ZnButton>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: {
    variant: 'primary',
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    default: 'Speichern nicht möglich',
  },
}

export const Danger: Story = {
  args: {
    variant: 'danger',
    default: 'Löschen',
  },
}
