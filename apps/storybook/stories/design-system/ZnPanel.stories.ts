import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { ZnBadge, ZnPanel } from '@zupfnoter/design-system'

const meta = {
  title: 'Design System/ZnPanel',
  component: ZnPanel,
  subcomponents: { ZnBadge },
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'Rahmen für eigenständige Inhaltsbereiche mit optionalem Eyebrow, Titel, Untertitel und Footer. `variant="card"` zeichnet den eigenständigen Rahmen; `variant="workspace"` liefert die dichte, rahmenlose Fläche für Split-Panes. `fillHeight` entscheidet, ob das Panel den verfügbaren Raum ausfüllt.' } } },
  argTypes: {
    tone: {
      control: 'select',
      options: ['surface', 'sunken', 'accent'],
    },
    variant: {
      control: 'select',
      options: ['card', 'workspace'],
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

export const Workspace: Story = {
  args: {
    title: 'Arbeitsfläche',
    tone: 'surface',
    variant: 'workspace',
    fillHeight: true,
  },
  render: (args) => ({
    components: { ZnPanel },
    setup: () => ({ args }),
    template: `
      <div style="height: 16rem; border: 1px solid var(--zn-border);">
        <ZnPanel v-bind="args">
          <div style="height: 100%; border: 1px solid var(--zn-border); background: var(--zn-bg-surface);">
            Dichte Workbench-Fläche
          </div>
        </ZnPanel>
      </div>
    `,
  }),
}
