import type { Meta, StoryObj } from '@storybook/vue3-vite'

import WorkbenchToastStack from '../../src/workbench/toasts/WorkbenchToastStack.vue'

const meta = { title: 'Workbench/WorkbenchToastStack', component: WorkbenchToastStack, tags: ['autodocs'] } satisfies Meta<typeof WorkbenchToastStack>
export default meta
type Story = StoryObj<typeof meta>

export const RenderError: Story = { args: { toasts: [{ id: 1, severity: 'danger', title: 'ABC-Parser', message: 'Zeile 56: fehlerhaftes Zeichen m' }] } }
export const PlaybackLink: Story = { args: { toasts: [{ id: 2, severity: 'info', title: 'Playback-Link', message: 'Link wurde in die Zwischenablage kopiert.', qrCodeDataUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="120"%3E%3Crect width="120" height="120" fill="white"/%3E%3Cpath d="M10 10h30v30H10zM80 10h30v30H80zM10 80h30v30H10zM55 55h10v10H55zM75 75h10v10H75zM95 55h10v10H95z" fill="black"/%3E%3C/svg%3E' }] } }

