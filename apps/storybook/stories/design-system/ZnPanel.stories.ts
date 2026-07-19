import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ZnBadge from '../../../web/src/design-system/components/ZnBadge.vue'
import ZnPanel from '../../../web/src/design-system/components/ZnPanel.vue'

const meta = {
  title: 'Design System/ZnPanel',
  component: ZnPanel,
  subcomponents: { ZnBadge },
  tags: ['autodocs'],
  argTypes: {
    tone: {
      control: 'select',
      options: ['surface', 'sunken', 'accent'],
    },
  },
} satisfies Meta<typeof ZnPanel>

export default meta
type Story = StoryObj<typeof meta>

export const PreviewPanel: Story = {
  args: {
    title: 'Harfennoten',
    subtitle: 'Aktuelle Vorschau des ausgewählten Auszugs',
    eyebrow: 'Vorschau',
    tone: 'surface',
    fillHeight: false,
  },
  render: (args) => ({
    components: { ZnPanel, ZnBadge },
    setup: () => ({ args }),
    template: `
      <ZnPanel v-bind="args">
        <div style="display: grid; gap: 0.75rem; min-width: 18rem;">
          <p style="margin: 0;">Hier kann später eine deterministische SVG-Fixture stehen.</p>
          <ZnBadge tone="success">Bereit</ZnBadge>
        </div>
      </ZnPanel>
    `,
  }),
}

export const EmptyState: Story = {
  args: {
    title: 'Keine Vorschau',
    subtitle: 'Es wurde noch kein Dokument geladen.',
    tone: 'sunken',
    fillHeight: false,
  },
  render: (args) => ({
    components: { ZnPanel },
    setup: () => ({ args }),
    template: `
      <ZnPanel v-bind="args">
        <p style="margin: 0; color: var(--zn-text-muted);">ABC-Datei öffnen, um die Vorschau zu sehen.</p>
      </ZnPanel>
    `,
  }),
}
