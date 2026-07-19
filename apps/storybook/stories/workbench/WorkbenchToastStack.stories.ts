import type { Meta, StoryObj } from '@storybook/vue3-vite'

import WorkbenchToastStack from '../../../web/src/workbench/toasts/WorkbenchToastStack.vue'

const meta = { title: 'Workbench/WorkbenchToastStack', component: WorkbenchToastStack, tags: ['autodocs'] } satisfies Meta<typeof WorkbenchToastStack>
export default meta
type Story = StoryObj<typeof meta>

const qrCodeDataUrl = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="120"%3E%3Crect width="120" height="120" fill="white"/%3E%3Cpath d="M10 10h30v30H10zM80 10h30v30H80zM10 80h30v30H10zM55 55h10v10H55zM75 75h10v10H75zM95 55h10v10H95z" fill="black"/%3E%3C/svg%3E'

export const RenderError: Story = {
  args: { toasts: [{ id: 1, severity: 'danger', title: 'ABC-Parser', message: 'Zeile 56: fehlerhaftes Zeichen m', persistent: true }] },
}

export const CommandError: Story = {
  args: { toasts: [{ id: 2, severity: 'danger', title: 'Kommando fehlgeschlagen', message: 'Speichern nicht möglich: ungültiger Dateiname', persistent: true }] },
}

export const FileInfo: Story = {
  args: { toasts: [{ id: 3, severity: 'info', title: 'Datei', message: 'Diese Funktion ist in einer späteren Phase verfügbar.' }] },
}

export const OpenWarning: Story = {
  args: { toasts: [{ id: 4, severity: 'warning', title: 'Öffnen', message: 'Die Datei konnte nicht geladen werden.' }] },
}

export const StorageConnectionWarning: Story = {
  args: { toasts: [{ id: 5, severity: 'warning', title: 'Speicherverbindung', message: 'Die Ordner konnten nicht geladen werden.' }] },
}

export const ProviderUnavailable: Story = {
  args: { toasts: [{ id: 6, severity: 'warning', title: 'Speicherverbindung', message: 'nextcloud ist noch nicht verfügbar.' }] },
}

export const PlaybackLink: Story = {
  args: { toasts: [{ id: 7, severity: 'info', title: 'Playback-Link', message: 'Der Playback-Link (T01-01) wurde in die Zwischenablage kopiert.', qrCodeDataUrl, persistent: true }] },
}

export const LongPlaybackLink: Story = {
  args: { toasts: [{ id: 8, severity: 'warning', title: 'Playback-Link', message: 'Ereignisse: 842\nURL-Länge: 2.146 Zeichen · QR-Code dicht, aber brauchbar.\nDer Link (T01-01) ist lang und kann sich für QR-Code oder Messenger schlecht eignen.', qrCodeDataUrl, persistent: true }] },
}

export const ClipboardBlocked: Story = {
  args: { toasts: [{ id: 9, severity: 'warning', title: 'Playback-Link', message: 'Das automatische Kopieren wurde vom Browser blockiert. Der Link wurde zur manuellen Übernahme angezeigt.', qrCodeDataUrl, persistent: true }] },
}

export const DropboxError: Story = {
  args: { toasts: [{ id: 10, severity: 'danger', title: 'Dropbox', message: 'Dropbox konnte die Verbindung nicht herstellen.', persistent: true }] },
}

export const AllWorkbenchToasts: Story = {
  args: {
    toasts: [
      { id: 11, severity: 'danger', title: 'ABC-Parser', message: 'Zeile 56: fehlerhaftes Zeichen m', persistent: true },
      { id: 12, severity: 'danger', title: 'Dropbox', message: 'Dropbox konnte die Verbindung nicht herstellen.', persistent: true },
      { id: 13, severity: 'warning', title: 'Speicherverbindung', message: 'nextcloud ist noch nicht verfügbar.' },
      { id: 14, severity: 'warning', title: 'Öffnen', message: 'Die Datei konnte nicht geladen werden.' },
      { id: 15, severity: 'info', title: 'Datei', message: 'Diese Funktion ist in einer späteren Phase verfügbar.' },
      { id: 16, severity: 'info', title: 'Playback-Link', message: 'Der Playback-Link wurde in die Zwischenablage kopiert.', qrCodeDataUrl, persistent: true },
    ],
  },
}
