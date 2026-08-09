import type { Meta, StoryObj } from '@storybook/vue3-vite'

import FooterBar from '../../../web/src/workbench/FooterBar.vue'

const meta = { title: 'Workbench/FooterBar', component: FooterBar, tags: ['autodocs'] } satisfies Meta<typeof FooterBar>
export default meta
type Story = StoryObj<typeof meta>

const args = {
  extractLabel: 'Auszug 0',
  storageLocation: 'Privat · /Noten',
  storageReadOnly: false,
  dirty: false,
  saveFormat: 'A4',
  speedBpm: 100,
  metronomeMode: 'off' as const,
  cursorPosition: 'Zeile 1, Spalte 1',
  selectionVoiceScope: 'extract-voices' as const,
  selectionVoiceScopeSummary: 'Auswahl im aktuellen Auszug',
}

export const Saved: Story = { args }
export const ReadOnlyWithChanges: Story = { args: { ...args, storageReadOnly: true, dirty: true, storageLocation: 'Michael · /Freigabe' } }
