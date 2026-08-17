<script setup lang="ts">
import { computed } from 'vue'
import { createTextDiff, type DiffLine } from '../workbench/git/textDiff'

const props = withDefaults(defineProps<{
  oldText: string
  newText: string
  oldLabel?: string
  newLabel?: string
}>(), {
  oldLabel: 'Alt',
  newLabel: 'Neu',
})

const lines = computed<DiffLine[]>(() => createTextDiff(props.oldText, props.newText))
</script>

<template>
  <div class="inline-text-diff" role="table" aria-label="Textvergleich">
    <div class="inline-text-diff__header" role="row">
      <span class="inline-text-diff__header-number" :title="oldLabel">Alt</span>
      <span class="inline-text-diff__header-number" :title="newLabel">Neu</span>
      <span class="inline-text-diff__header-marker" aria-hidden="true"></span>
      <span>Änderung</span>
    </div>
    <div v-for="(line, index) in lines" :key="`${index}-${line.oldLineNumber ?? ''}-${line.newLineNumber ?? ''}`" class="inline-text-diff__line" :data-type="line.type" role="row">
      <span class="inline-text-diff__number" role="cell">{{ line.oldLineNumber ?? '' }}</span>
      <span class="inline-text-diff__number" role="cell">{{ line.newLineNumber ?? '' }}</span>
      <span class="inline-text-diff__marker" role="cell" aria-hidden="true">{{ line.type === 'added' ? '+' : line.type === 'removed' ? '−' : line.type === 'changed' ? '±' : ' ' }}</span>
      <code class="inline-text-diff__content" role="cell"><span v-for="(segment, segmentIndex) in line.segments" :key="`${segmentIndex}-${segment.value}`" :class="{ 'is-added': segment.type === 'added', 'is-removed': segment.type === 'removed' }">{{ segment.value }}</span></code>
    </div>
  </div>
</template>

<style scoped>
.inline-text-diff{display:block;max-height:calc(100vh - 12rem);min-height:12rem;overflow:auto;border:1px solid var(--zn-border);border-radius:var(--zn-radius-sm);background:var(--zn-bg-surface);color:var(--zn-text);font:var(--zn-font-size-sm, .82rem)/1.5 var(--zn-font-mono, ui-monospace, monospace)}
.inline-text-diff__header,.inline-text-diff__line{display:grid;grid-template-columns:3.4rem 3.4rem 2rem minmax(max-content,1fr);min-width:38rem}
.inline-text-diff__header{position:sticky;top:0;z-index:1;padding:.35rem .5rem;border-bottom:1px solid var(--zn-border);background:var(--zn-bg-surface);color:var(--zn-text-soft);font:var(--zn-font-size-xs, .72rem)/1.2 var(--zn-font)}
.inline-text-diff__header-number{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}
.inline-text-diff__header-marker{display:block}
.inline-text-diff__line{min-height:1.5rem}
.inline-text-diff__line[data-type=added]{background:color-mix(in srgb,var(--zn-success) 12%,var(--zn-bg-surface))}
.inline-text-diff__line[data-type=removed]{background:color-mix(in srgb,var(--zn-danger) 12%,var(--zn-bg-surface))}
.inline-text-diff__line[data-type=changed]{background:color-mix(in srgb,var(--zn-warning) 7%,var(--zn-bg-surface))}
.inline-text-diff__number,.inline-text-diff__marker{padding:0 .45rem;color:var(--zn-text-soft);text-align:right;user-select:none}
.inline-text-diff__marker{color:var(--zn-text-soft);text-align:center}
.inline-text-diff__content{padding:0 .55rem;white-space:pre}
.inline-text-diff__content .is-added{background:color-mix(in srgb,var(--zn-success) 38%,transparent);color:var(--zn-heading)}
.inline-text-diff__content .is-removed{background:color-mix(in srgb,var(--zn-danger) 38%,transparent);color:var(--zn-heading);text-decoration:line-through}
</style>
