<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { StorageConnection, StorageProviderDescriptor } from '@zupfnoter/types'
import { ZnButton, ZnIconButton } from '@zupfnoter/design-system'

const props = defineProps<{
  open: boolean
  connections: StorageConnection[]
  providers: StorageProviderDescriptor[]
  activeConnectionId?: string
}>()

const emit = defineEmits<{
  close: []
  create: [providerId: string, label: string]
  activate: [connectionId: string]
  update: [connectionId: string, label: string]
  remove: [connectionId: string]
  reconnect: [connectionId: string]
  disconnect: [connectionId: string]
  root: [connectionId: string]
  readonly: [connectionId: string, readOnly: boolean]
}>()

const providerId = ref('dropbox')
const label = ref('')
const newConnectionVisible = ref(false)

function createConnection(): void {
  const provider = props.providers.find((entry) => entry.id === providerId.value)
  if (provider === undefined || provider.availability !== 'available') return
  emit('create', provider.id, label.value)
  label.value = ''
  newConnectionVisible.value = false
}

function startNewConnection(): void {
  newConnectionVisible.value = true
}

function providerLabel(providerId: string): string {
  return props.providers.find((provider) => provider.id === providerId)?.label ?? providerId
}

function statusLabel(status: StorageConnection['status']): string {
  const labels: Record<StorageConnection['status'], string> = {
    connected: 'Verbunden',
    connecting: 'Verbinden …',
    disconnected: 'Getrennt',
    planned: 'Geplant',
  }
  return labels[status]
}

function statusClass(status: StorageConnection['status']): string {
  return `storage-dialog__status-dot--${status}`
}

type ConnectionAction = 'reconnect' | 'disconnect' | 'remove'

function runConnectionAction(event: MouseEvent, action: ConnectionAction, connectionId: string): void {
  const target = event.currentTarget
  if (target instanceof HTMLElement) target.closest('details')?.removeAttribute('open')
  if (action === 'reconnect') emit('reconnect', connectionId)
  if (action === 'disconnect') emit('disconnect', connectionId)
  if (action === 'remove') emit('remove', connectionId)
}

function positionConnectionActionMenu(event: Event): void {
  const details = event.currentTarget
  if (!(details instanceof HTMLDetailsElement) || !details.open) return
  const menu = details.querySelector<HTMLElement>('.storage-dialog__action-menu-items')
  const dialog = details.closest<HTMLElement>('.storage-dialog')
  if (menu === null || dialog === null) return
  const detailsRect = details.getBoundingClientRect()
  const dialogRect = dialog.getBoundingClientRect()
  const menuHeight = menu.getBoundingClientRect().height
  const availableBelow = Math.max(0, dialogRect.bottom - detailsRect.bottom - 8)
  const availableAbove = Math.max(0, detailsRect.top - dialogRect.top - 8)
  const opensUp = availableAbove > availableBelow
  const availableHeight = Math.max(48, Math.floor(Math.max(availableAbove, availableBelow)))
  menu.style.setProperty('--action-menu-max-height', `${availableHeight}px`)
  details.classList.toggle('storage-dialog__action-menu--up', opensUp)
}

function handleDialogKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter') return
  event.preventDefault()
  emit('close')
}

function handleWindowKeydown(event: KeyboardEvent): void {
  if (!props.open || event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  emit('close')
}

onMounted(() => window.addEventListener('keydown', handleWindowKeydown, true))
onBeforeUnmount(() => window.removeEventListener('keydown', handleWindowKeydown, true))
</script>

<template>
  <Teleport to="body">
    <div v-if="props.open" class="storage-dialog__backdrop">
      <section class="storage-dialog" role="dialog" aria-modal="true" aria-labelledby="storage-dialog-title" tabindex="-1" @keydown="handleDialogKeydown">
        <header class="storage-dialog__header">
          <h2 id="storage-dialog-title">Speicherverbindungen</h2>
          <div class="storage-dialog__header-actions">
            <ZnButton class="storage-dialog__new-button" variant="primary" @click="startNewConnection">Neue Verbindung</ZnButton>
            <span class="storage-dialog__hint">Verbindungen werden auf diesem Gerät gespeichert.</span>
            <ZnButton variant="ghost" aria-label="Speicherverbindungen schließen" @click="emit('close')">×</ZnButton>
          </div>
        </header>
        <div class="storage-dialog__body">
          <form @submit.prevent="createConnection">
            <div class="storage-dialog__table-wrap">
              <table class="storage-dialog__table" aria-label="Gespeicherte Verbindungen">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Anbieter</th>
                  <th>Wurzel</th>
                  <th>Zugriff</th>
                  <th>Status</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="connection in props.connections" :key="connection.id" :class="{ 'storage-dialog__row--active': connection.id === props.activeConnectionId }">
                  <td>
                    <input
                      :value="connection.label"
                      :aria-label="`Name der Verbindung ${connection.label}`"
                      @change="emit('update', connection.id, ($event.target as HTMLInputElement).value)"
                    >
                  </td>
                  <td>{{ providerLabel(connection.providerId) }}</td>
                  <td class="storage-dialog__root">
                    <span :title="connection.rootPath === '' ? '/' : `/${connection.rootPath}`">{{ connection.rootPath === '' ? '/' : `/${connection.rootPath}` }}</span>
                    <ZnIconButton class="storage-dialog__root-button" label="Wurzelordner wählen" variant="ghost" @click="emit('root', connection.id)">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M3.5 7.5h6l1.7 2h9.3v9.5H3.5zM3.5 7.5V5.5h6l1.7 2" />
                      </svg>
                    </ZnIconButton>
                  </td>
                  <td>
                    <label class="storage-dialog__readonly">
                      <input
                        class="storage-dialog__switch-input"
                        type="checkbox"
                        :checked="!connection.readOnly"
                        :aria-label="`Verbindung ${connection.label} kann schreiben`"
                        @change="emit('readonly', connection.id, !($event.target as HTMLInputElement).checked)"
                      >
                      <span class="storage-dialog__switch" aria-hidden="true" />
                      <span>Kann schreiben</span>
                    </label>
                  </td>
                  <td class="storage-dialog__status">
                    <span class="storage-dialog__status-content">
                      <span class="storage-dialog__status-dot" :class="statusClass(connection.status)" :title="statusLabel(connection.status)" :aria-label="statusLabel(connection.status)" role="img" />
                      <label class="storage-dialog__activate">
                        <input
                          type="radio"
                          name="active-storage-connection"
                          :checked="connection.id === props.activeConnectionId"
                          :aria-label="`Verbindung ${connection.label} aktivieren`"
                          @change="emit('activate', connection.id)"
                        >
                      </label>
                    </span>
                  </td>
                  <td class="storage-dialog__actions">
                    <details class="storage-dialog__action-menu" @toggle="positionConnectionActionMenu">
                      <summary aria-haspopup="menu" :aria-label="`Aktionen für Verbindung ${connection.label}`">⋯</summary>
                      <div class="storage-dialog__action-menu-items" role="menu">
                        <button type="button" role="menuitem" @click="runConnectionAction($event, 'reconnect', connection.id)">{{ connection.status === 'connected' ? 'Erneuern' : 'Anmelden' }}</button>
                        <button v-if="connection.status === 'connected'" type="button" role="menuitem" @click="runConnectionAction($event, 'disconnect', connection.id)">Trennen</button>
                        <button type="button" role="menuitem" @click="runConnectionAction($event, 'remove', connection.id)">Löschen</button>
                      </div>
                    </details>
                  </td>
                </tr>
                <tr v-if="newConnectionVisible" class="storage-dialog__new-row">
                  <td>
                    <input v-model="label" aria-label="Name der neuen Verbindung" placeholder="z. B. Privat">
                  </td>
                  <td>
                    <select v-model="providerId" aria-label="Anbieter für neue Verbindung">
                      <option v-for="provider in props.providers" :key="provider.id" :value="provider.id" :disabled="provider.availability === 'planned'">
                        {{ provider.label }}{{ provider.availability === 'planned' ? ' · geplant' : '' }}
                      </option>
                    </select>
                  </td>
                  <td>nach dem Verbinden wählen</td>
                  <td>beschreibbar</td>
                  <td>neu</td>
                  <td class="storage-dialog__actions"><ZnButton variant="primary" type="submit">Verbinden</ZnButton></td>
                </tr>
              </tbody>
              </table>
            </div>
          </form>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.storage-dialog__backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: .75rem; background: rgb(15 23 42 / .45); }
.storage-dialog { width: min(70rem, calc(100vw - 1.5rem)); min-height: min(28rem, calc(100vh - 1.5rem)); border: 1px solid var(--zn-border-strong); border-radius: .85rem; background: var(--zn-bg-elevated); color: var(--zn-text); box-shadow: 0 16px 36px rgb(15 23 42 / .22); }
.storage-dialog__header { display:flex; align-items:center; justify-content:space-between; gap:.75rem; padding:.65rem .75rem; border-bottom:1px solid var(--zn-border); }
.storage-dialog__header-actions { display:flex; align-items:center; gap:.4rem; }
.storage-dialog__new-button { min-height:1.8rem; padding:.2rem .55rem; font-size:.78rem; }
.storage-dialog__hint { color:var(--zn-text-soft); font-size:.78rem; white-space:nowrap; }
.storage-dialog__body { display:grid; gap:.55rem; padding:.65rem .75rem .75rem; }
.storage-dialog__table-wrap { overflow:visible; }
.storage-dialog__table { width:100%; min-width:50rem; table-layout:fixed; border-collapse:collapse; font-size:.82rem; }
.storage-dialog__table th,.storage-dialog__table td { padding:.32rem .4rem; border-bottom:1px solid var(--zn-border); text-align:left; vertical-align:middle; }
.storage-dialog__table th:first-child,.storage-dialog__table td:first-child { width:18%; min-width:12rem; }
.storage-dialog__table th:nth-child(2),.storage-dialog__table td:nth-child(2) { width:12%; }
.storage-dialog__table th:nth-child(3),.storage-dialog__table td:nth-child(3) { width:35%; }
.storage-dialog__table th:nth-child(4),.storage-dialog__table td:nth-child(4) { width:15%; }
.storage-dialog__table th:nth-child(5),.storage-dialog__table td:nth-child(5) { width:8%; }
.storage-dialog__table th:nth-child(6),.storage-dialog__table td:nth-child(6) { width:12%; }
.storage-dialog__table th:nth-child(5) { text-align:center; }
.storage-dialog__table th { color:var(--zn-text-soft); font-size:.72rem; font-weight:600; }
.storage-dialog__row--active { background:color-mix(in srgb, var(--zn-accent) 15%, transparent); box-shadow:inset .22rem 0 0 var(--zn-accent); }
.storage-dialog__new-row { background:var(--zn-bg-surface-soft); }
.storage-dialog__actions { text-align:center; }
.storage-dialog__activate { display:flex; align-items:center; gap:.25rem; min-width:0; white-space:nowrap; cursor:pointer; }
.storage-dialog__activate input[type="radio"] { inline-size:1rem; block-size:1rem; min-height:1rem; width:auto; flex:0 0 1rem; margin:0; padding:0; border:0; background:transparent; accent-color:var(--zn-accent); appearance:auto; }
.storage-dialog__action-menu { position:relative; display:inline-block; }
.storage-dialog__action-menu[open] { z-index:20; }
.storage-dialog__action-menu summary { display:grid; place-items:center; inline-size:1.8rem; block-size:1.8rem; border:1px solid var(--zn-border); border-radius:var(--zn-radius-sm); color:var(--zn-text); cursor:pointer; font-size:1.2rem; line-height:1; list-style:none; }
.storage-dialog__action-menu summary::-webkit-details-marker { display:none; }
.storage-dialog__action-menu summary:hover,.storage-dialog__action-menu[open] summary { background:var(--zn-bg-surface-soft); }
.storage-dialog__action-menu-items { position:absolute; z-index:30; inset-block-start:calc(100% + .25rem); inset-inline-end:0; display:grid; max-block-size:var(--action-menu-max-height, 14rem); min-inline-size:8rem; overflow-y:auto; padding:.25rem; border:1px solid var(--zn-border-strong); border-radius:var(--zn-radius-sm); background:var(--zn-bg-elevated); box-shadow:0 .35rem 1rem rgb(15 23 42 / .2); }
.storage-dialog__action-menu--up .storage-dialog__action-menu-items { inset-block-start:auto; inset-block-end:calc(100% + .25rem); }
.storage-dialog__action-menu-items button { padding:.35rem .5rem; border:0; border-radius:var(--zn-radius-sm); background:transparent; color:var(--zn-text); cursor:pointer; font:inherit; text-align:left; white-space:nowrap; }
.storage-dialog__action-menu-items button:hover,.storage-dialog__action-menu-items button:focus-visible { background:var(--zn-bg-surface-soft); }
.storage-dialog__root { display:flex; align-items:center; gap:.25rem; min-width:0; max-width:none; white-space:nowrap; }
.storage-dialog__root > span { overflow:hidden; text-overflow:ellipsis; }
.storage-dialog__root-button { inline-size:1.45rem; block-size:1.45rem; }
.storage-dialog__root-button svg { inline-size:.85rem; block-size:.85rem; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
.storage-dialog__readonly { position:relative; display:flex; align-items:center; gap:.35rem; white-space:nowrap; cursor:pointer; }
.storage-dialog__status { white-space:normal; line-height:1.45; text-align:center !important; }
.storage-dialog__status-content { display:inline-flex; align-items:center; justify-content:center; gap:.45rem; vertical-align:middle; }
.storage-dialog__status-dot { display:inline-block; flex:0 0 .72rem; inline-size:.72rem; block-size:.72rem; border-radius:50%; box-shadow:0 0 0 1px rgb(15 23 42 / .18); }
.storage-dialog__status-dot--connected { background:#22c55e; }
.storage-dialog__status-dot--connecting { background:#eab308; }
.storage-dialog__status-dot--disconnected { background:#ef4444; }
.storage-dialog__status-dot--planned { background:#94a3b8; }
.storage-dialog__switch-input { position:absolute; inline-size:1px; block-size:1px; overflow:hidden; clip-path:inset(50%); }
.storage-dialog__switch { position:relative; inline-size:1.75rem; block-size:1rem; flex:0 0 auto; border-radius:999px; background:var(--zn-border-strong); transition:background .15s ease; }
.storage-dialog__switch::after { position:absolute; inset-block-start:.14rem; inset-inline-start:.14rem; inline-size:.72rem; block-size:.72rem; border-radius:50%; background:var(--zn-bg-elevated); content:''; transition:transform .15s ease; }
.storage-dialog__switch-input:checked + .storage-dialog__switch { background:var(--zn-accent); }
.storage-dialog__switch-input:checked + .storage-dialog__switch::after { transform:translateX(.75rem); }
.storage-dialog__switch-input:focus-visible + .storage-dialog__switch { outline:2px solid var(--zn-accent); outline-offset:2px; }
.storage-dialog input,.storage-dialog select { min-height:1.8rem; padding:.22rem .35rem; border:1px solid var(--zn-border); border-radius:var(--zn-radius-sm); background:var(--zn-bg-surface); color:var(--zn-text); font:inherit; }
.storage-dialog__table input { width:100%; box-sizing:border-box; }
@media (max-width: 48rem) {
  .storage-dialog__backdrop { place-items:start center; overflow:auto; }
  .storage-dialog { margin-block:.5rem; }
  .storage-dialog__table-wrap { overflow-x:auto; }
  .storage-dialog__header { align-items:flex-start; }
  .storage-dialog__header-actions { flex-wrap:wrap; justify-content:flex-end; }
  .storage-dialog__hint { display:none; }
}
</style>
