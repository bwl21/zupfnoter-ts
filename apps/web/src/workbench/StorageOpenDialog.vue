<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { StorageDocument } from '@zupfnoter/types'
import { ZnButton, ZnIconButton } from '@zupfnoter/design-system'
import { matchesStorageDocumentQuery } from './storage/documentSearch'

const props = defineProps<{ open: boolean; locationLabel: string; path: string; documents: StorageDocument[]; loading: boolean; previewUrl?: string; previewLoading: boolean; previewError: string }>()
const emit = defineEmits<{ close: []; search: [query: string]; open: [document: StorageDocument]; preview: [path: string]; connections: [] }>()
const query = ref('')
const selectedDocument = ref<StorageDocument>()
const selectedPreviewPath = ref('')
const filteredDocuments = computed(() => {
  const filter = query.value.trim().toLocaleLowerCase()
  return filter === '' ? [] : props.documents.filter((entry) => matchesStorageDocumentQuery(entry.name, filter))
})
const selectedPreviews = computed(() => selectedDocument.value === undefined
  ? []
  : [...selectedDocument.value.previewPdfPaths, ...selectedDocument.value.previewHtmlPaths])
watch(() => props.open, (open) => { if (!open) { query.value = ''; selectedDocument.value = undefined; selectedPreviewPath.value = '' } })
watch(query, (value) => { selectedDocument.value = undefined; selectedPreviewPath.value = ''; emit('search', value) })
function formatDate(value: string | undefined): string { return value === undefined ? '–' : new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function selectDocument(document: StorageDocument): void {
  selectedDocument.value = document
  selectedPreviewPath.value = [...document.previewPdfPaths, ...document.previewHtmlPaths][0] ?? ''
  if (selectedPreviewPath.value !== '') emit('preview', selectedPreviewPath.value)
}
function selectPreview(): void { if (selectedPreviewPath.value !== '') emit('preview', selectedPreviewPath.value) }
</script>

<template>
  <Teleport to="body"><div v-if="open" class="open-dialog__backdrop"><section class="open-dialog" role="dialog" aria-modal="true" aria-labelledby="open-dialog-title">
    <header><div><p>Speicherort: {{ locationLabel }} · /{{ path }}</p><h2 id="open-dialog-title">ABC-Datei laden</h2></div><div class="open-dialog__header-actions"><ZnButton variant="ghost" @click="emit('connections')">Speicherverbindungen</ZnButton><ZnIconButton label="Öffnen-Dialog schließen" variant="ghost" @click="emit('close')">×</ZnIconButton></div></header>
    <label class="open-dialog__filter">Filter<input v-model="query" type="search" placeholder="Dateiname eingeben" autofocus></label>
    <div class="open-dialog__content"><section class="open-dialog__list"><p v-if="query.trim() === ''" class="open-dialog__empty">Dateinamen eingeben, um ABC-Dateien in diesem Ordner zu suchen.</p><p v-else-if="loading" class="open-dialog__empty">Dateien werden geladen …</p><p v-else-if="filteredDocuments.length === 0" class="open-dialog__empty">Keine passenden ABC-Dateien.</p><table v-else><thead><tr><th>Datei</th><th>Geändert</th></tr></thead><tbody><tr v-for="document in filteredDocuments" :key="document.path" :class="{ 'open-dialog__row--selected': selectedDocument?.path === document.path }"><td><button type="button" @click="selectDocument(document)">{{ document.name }}</button></td><td>{{ formatDate(document.modifiedAt) }}</td></tr></tbody></table></section><aside class="open-dialog__preview"><template v-if="selectedDocument === undefined"><p>ABC-Datei wählen</p></template><template v-else><header class="open-dialog__preview-header"><strong>{{ selectedDocument.name }}</strong><ZnButton variant="primary" @click="emit('open', selectedDocument)">Öffnen</ZnButton></header><label class="open-dialog__preview-select">Vorschau<select v-model="selectedPreviewPath" :disabled="selectedPreviews.length === 0" @change="selectPreview"><option v-if="selectedPreviews.length === 0" value="">Keine Vorschau vorhanden</option><option v-for="preview in selectedPreviews" :key="preview" :value="preview">{{ preview.split('/').pop() }}</option></select></label><p v-if="previewLoading">Vorschau wird geladen …</p><p v-else-if="previewError !== ''">{{ previewError }}</p><iframe v-else-if="previewUrl !== undefined" :src="previewUrl" title="Dateivorschau" /></template></aside></div>
    <footer><ZnButton variant="ghost" @click="emit('close')">Schließen</ZnButton></footer>
  </section></div></Teleport>
</template>

<style scoped>
.open-dialog__backdrop{position:fixed;inset:0;z-index:1010;display:grid;place-items:center;padding:.75rem;background:rgb(15 23 42 / .45)}.open-dialog{display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;width:min(70rem,calc(100vw - 1.5rem));height:min(42rem,calc(100vh - 1.5rem));overflow:hidden;border:1px solid var(--zn-border-strong);border-radius:.85rem;background:var(--zn-bg-elevated);color:var(--zn-text)}header,footer{display:flex;align-items:center;justify-content:space-between;padding:.7rem .9rem;border-bottom:1px solid var(--zn-border)}header p{margin:0;color:var(--zn-text-soft);font-size:.78rem}h2{margin:.1rem 0 0;font-size:1.1rem}.open-dialog__header-actions{display:flex;align-items:center;gap:.4rem}.open-dialog__filter{display:grid;grid-template-columns:4rem 1fr;gap:.5rem;align-items:center;padding:.6rem .9rem;border-bottom:1px solid var(--zn-border)}input{min-width:0;padding:.38rem .5rem;border:1px solid var(--zn-border);border-radius:var(--zn-radius-sm);font:inherit}.open-dialog__content{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(18rem,.9fr);min-height:0}.open-dialog__list{min-height:0;overflow:auto;padding:.5rem}.open-dialog__empty{margin:2rem;color:var(--zn-text-soft);text-align:center}table{width:100%;border-collapse:collapse;font-size:.86rem}th,td{padding:.45rem;text-align:left;border-bottom:1px solid var(--zn-border)}td button,.open-dialog__preview-files button{border:0;background:transparent;color:var(--zn-accent-strong);font:inherit;cursor:pointer}.open-dialog__row--selected{background:var(--zn-bg-surface-soft)}td button:hover,.open-dialog__preview-files button:hover{text-decoration:underline}.open-dialog__preview{display:grid;grid-template-rows:auto auto minmax(0,1fr);min-height:0;border-left:1px solid var(--zn-border);padding:.5rem}.open-dialog__preview p{color:var(--zn-text-soft);text-align:center}.open-dialog__preview-header{padding:0;border:0}.open-dialog__preview-files{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center;padding:.5rem 0}.open-dialog__preview-files span{color:var(--zn-text-soft);font-size:.8rem}.open-dialog__preview-files p{width:100%;margin:.25rem 0;text-align:left}.open-dialog__preview iframe{width:100%;height:100%;min-height:0;border:0}footer{border-top:1px solid var(--zn-border);border-bottom:0;justify-content:flex-end}@media(max-width:48rem){.open-dialog__content{grid-template-columns:1fr;grid-template-rows:minmax(15rem,1fr) 16rem}.open-dialog__preview{border-left:0;border-top:1px solid var(--zn-border)}}
header p { font-size: .88rem; }
</style>
