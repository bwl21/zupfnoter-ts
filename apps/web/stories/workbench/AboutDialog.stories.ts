import type { Meta, StoryObj } from '@storybook/vue3-vite'

import AboutDialog from '../../src/workbench/AboutDialog.vue'

const meta = { title: 'Workbench/Dialog/AboutDialog', component: AboutDialog, tags: ['autodocs'] } satisfies Meta<typeof AboutDialog>
export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = { args: { open: true, appVersion: 'zupfnoter-ts', commitHash: 'storybook', buildTime: '2026-07-18T20:00:00.000Z' } }
