<script setup lang="ts">
import ZnButton from '../design-system/components/ZnButton.vue'

defineProps<{
  open: boolean
  path: string
  folders: Array<{ name: string; path: string }>
  loading: boolean
}>()

const emit = defineEmits<{
  close: []
  browse: [path: string]
  choose: [path: string]
}>()

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
        <header>
          <h2 id="root-picker-title">Wurzelordner wählen</h2>
          <ZnButton variant="ghost" aria-label="Ordnerauswahl schließen" @click="emit('close')">×</ZnButton>
        </header>
        <p>Aktueller Ordner: <strong>{{ path === '' ? '/' : `/${path}` }}</strong></p>
        <div class="root-picker__actions">
          <ZnButton variant="ghost" :disabled="path === '' || loading" @click="emit('browse', parentPath(path))">Eine Ebene höher</ZnButton>
          <ZnButton variant="primary" :disabled="loading" @click="emit('choose', path)">Diesen Ordner verwenden</ZnButton>
        </div>
        <p v-if="loading">Ordner werden geladen …</p>
        <ul v-else class="root-picker__folders">
          <li v-for="folder in folders" :key="folder.path">
            <ZnButton variant="ghost" @click="emit('browse', folder.path)">{{ folder.name }}</ZnButton>
          </li>
        </ul>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.root-picker__backdrop { position:fixed; inset:0; z-index:1010; display:grid; place-items:center; padding:.75rem; background:rgb(15 23 42 / .45); }
.root-picker { width:min(34rem, calc(100vw - 1.5rem)); max-height:min(38rem, calc(100vh - 1.5rem)); overflow:auto; padding:.8rem; border:1px solid var(--zn-border-strong); border-radius:.85rem; background:var(--zn-bg-elevated); color:var(--zn-text); }
.root-picker header { display:flex; align-items:center; justify-content:space-between; gap:.5rem; }
.root-picker h2,.root-picker p { margin:.2rem 0 .6rem; }
.root-picker__actions { display:flex; justify-content:space-between; gap:.5rem; }
.root-picker__folders { display:grid; gap:.15rem; margin:.7rem 0 0; padding:0; list-style:none; }
</style>
