<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ZnButton, ZnIconButton } from '../design-system/index'

const props = defineProps<{
  open: boolean
  path: string
  folders: Array<{ name: string; path: string }>
  loading: boolean
}>()

const emit = defineEmits<{
  close: []
  browse: [path: string]
  refresh: []
  choose: [path: string]
}>()

const pathParts = computed(() => {
  const parts = props.path.split('/').filter((part) => part !== '')
  return parts.map((name, index) => ({ name, path: parts.slice(0, index + 1).join('/') }))
})
const folderQuery = ref('')
const filteredFolders = computed(() => {
  const query = folderQuery.value.trim().toLocaleLowerCase()
  if (query === '') return props.folders
  return props.folders.filter((folder) => folder.name.toLocaleLowerCase().includes(query))
})

watch(() => props.path, () => {
  folderQuery.value = ''
})

function parentPath(path: string): string {
  const parts = path.split('/').filter((part) => part !== '')
  parts.pop()
  return parts.join('/')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="root-picker__backdrop">
      <section class="root-picker" role="dialog" aria-modal="true" aria-labelledby="root-picker-title">
        <header class="root-picker__header">
          <div>
            <p class="root-picker__eyebrow">Speicherverbindung</p>
            <h2 id="root-picker-title">Wurzelordner wählen</h2>
          </div>
          <ZnIconButton label="Ordnerauswahl schließen" variant="ghost" @click="emit('close')">×</ZnIconButton>
        </header>

        <div class="root-picker__pathbar" aria-label="Aktueller Ordner">
          <button type="button" class="root-picker__up" aria-label="Eine Ebene höher" :disabled="path === '' || loading" @click="emit('browse', parentPath(path))">↑</button>
          <button type="button" class="root-picker__up" aria-label="Ordner neu laden" :disabled="loading" @click="emit('refresh')">↻</button>
          <nav class="root-picker__breadcrumbs" aria-label="Ordnerpfad">
            <button type="button" class="root-picker__crumb" :disabled="loading" @click="emit('browse', '')">Dropbox</button>
            <template v-for="part in pathParts" :key="part.path">
              <span aria-hidden="true">/</span>
              <button type="button" class="root-picker__crumb" :disabled="loading" @click="emit('browse', part.path)">{{ part.name }}</button>
            </template>
          </nav>
        </div>

        <div class="root-picker__search">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 4.5 4.5" /></svg>
          <input v-model="folderQuery" type="search" placeholder="Ordner in diesem Verzeichnis suchen" aria-label="Ordner suchen" :disabled="loading">
        </div>

        <section class="root-picker__folders" aria-label="Unterordner">
          <p v-if="loading" class="root-picker__empty">Ordner werden geladen …</p>
          <p v-else-if="filteredFolders.length === 0" class="root-picker__empty">{{ folderQuery === '' ? 'Dieser Ordner enthält keine Unterordner.' : 'Keine passenden Unterordner gefunden.' }}</p>
          <button v-for="folder in filteredFolders" v-else :key="folder.path" type="button" class="root-picker__folder" @click="emit('browse', folder.path)">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M3.5 7.5h6l1.7 2h9.3v9.5H3.5zM3.5 7.5V5.5h6l1.7 2" />
            </svg>
            <span>{{ folder.name }}</span>
            <span class="root-picker__folder-arrow" aria-hidden="true">›</span>
          </button>
        </section>

        <footer class="root-picker__footer">
          <ZnButton variant="ghost" @click="emit('close')">Abbrechen</ZnButton>
          <ZnButton variant="primary" :disabled="loading" @click="emit('choose', path)">Diesen Ordner verwenden</ZnButton>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.root-picker__backdrop { position:fixed; inset:0; z-index:1010; display:grid; place-items:center; padding:.75rem; background:rgb(15 23 42 / .45); }
.root-picker { display:grid; grid-template-rows:auto auto auto minmax(12rem, 1fr) auto; width:min(38rem, calc(100vw - 1.5rem)); max-height:min(38rem, calc(100vh - 1.5rem)); border:1px solid var(--zn-border-strong); border-radius:.85rem; background:var(--zn-bg-elevated); color:var(--zn-text); box-shadow:0 16px 36px rgb(15 23 42 / .22); overflow:hidden; }
.root-picker__header { display:flex; align-items:center; justify-content:space-between; gap:.75rem; padding:.75rem .85rem; border-bottom:1px solid var(--zn-border); }
.root-picker__eyebrow { margin:0; color:var(--zn-text-soft); font-size:.72rem; font-weight:600; letter-spacing:.04em; text-transform:uppercase; }
.root-picker h2 { margin:.1rem 0 0; font-size:1.1rem; }
.root-picker__pathbar { display:flex; align-items:center; gap:.35rem; min-width:0; padding:.45rem .75rem; border-bottom:1px solid var(--zn-border); background:var(--zn-bg-surface-soft); }
.root-picker__up { display:inline-grid; place-items:center; inline-size:2.1rem; block-size:2.1rem; flex:0 0 auto; border:0; border-radius:var(--zn-radius-md); background:transparent; color:var(--zn-text-muted); font-size:1.1rem; cursor:pointer; }
.root-picker__up:hover:not(:disabled) { background:var(--zn-bg-surface); color:var(--zn-text); }
.root-picker__up:disabled { cursor:default; opacity:.45; }
.root-picker__search { display:flex; align-items:center; gap:.4rem; padding:.45rem .75rem; border-bottom:1px solid var(--zn-border); }
.root-picker__search svg { width:1rem; height:1rem; flex:0 0 auto; fill:none; stroke:var(--zn-text-soft); stroke-width:1.8; stroke-linecap:round; }
.root-picker__search input { min-width:0; width:100%; border:1px solid var(--zn-border); border-radius:var(--zn-radius-sm); background:var(--zn-bg-surface); color:var(--zn-text); font:inherit; padding:.3rem .45rem; }
.root-picker__search input:focus { outline:2px solid var(--zn-accent); outline-offset:1px; }
.root-picker__breadcrumbs { display:flex; align-items:center; min-width:0; overflow-x:auto; color:var(--zn-text-soft); font-size:.82rem; white-space:nowrap; }
.root-picker__crumb { max-width:12rem; overflow:hidden; border:0; background:transparent; color:inherit; font:inherit; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; }
.root-picker__crumb:hover:not(:disabled) { color:var(--zn-accent); text-decoration:underline; }
.root-picker__crumb:disabled { cursor:default; }
.root-picker__folders { display:grid; align-content:start; gap:.05rem; min-height:0; overflow:auto; padding:.35rem; }
.root-picker__folder { display:grid; grid-template-columns:auto minmax(0, 1fr) auto; align-items:center; gap:.45rem; width:100%; min-height:2rem; padding:.25rem .45rem; border:1px solid transparent; border-radius:var(--zn-radius-sm); background:transparent; color:var(--zn-text); font:inherit; text-align:left; cursor:pointer; }
.root-picker__folder:hover { border-color:var(--zn-border); background:var(--zn-bg-surface-soft); }
.root-picker__folder:focus-visible { outline:2px solid var(--zn-accent); outline-offset:1px; }
.root-picker__folder svg { width:1rem; height:1rem; fill:none; stroke:var(--zn-accent); stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
.root-picker__folder span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.root-picker__folder-arrow { color:var(--zn-text-soft); font-size:1.25rem; }
.root-picker__empty { margin:1.4rem .5rem; color:var(--zn-text-soft); text-align:center; }
.root-picker__footer { display:flex; justify-content:space-between; gap:.5rem; padding:.6rem .75rem; border-top:1px solid var(--zn-border); }
@media (max-width: 34rem) { .root-picker__backdrop { place-items:start center; overflow:auto; } .root-picker { margin-block:.5rem; } }
</style>
