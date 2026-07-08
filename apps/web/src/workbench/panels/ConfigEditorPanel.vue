<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { Confstack, extractSongConfig, initConf, mergeSongConfig } from '@zupfnoter/core'

import ZnBadge from '../../design-system/components/ZnBadge.vue'
import ZnButton from '../../design-system/components/ZnButton.vue'
import ZnIconButton from '../../design-system/components/ZnIconButton.vue'
import ZnPanel from '../../design-system/components/ZnPanel.vue'
import ZnToolbar from '../../design-system/components/ZnToolbar.vue'

interface ConfigIntent {
  action:
    | 'config.undo'
    | 'config.redo'
    | 'config.quicksettings'
    | 'config.addEntry'
    | 'config.openMainMenu'
    | 'config.selectAffectedObject'
    | 'config.fillPath'
    | 'config.deletePath'
    | 'config.openMenuAtPath'
  path?: string
  extractId: number
}

interface ConfigTreeDefinition {
  key: string
  label: string
  children?: ConfigTreeDefinition[]
}

interface ConfigTreeRow {
  key: string
  path: string
  label: string
  depth: number
  isBranch: boolean
  isLeaf: boolean
  localPath?: string
  effectivePath?: string
  localValue?: unknown
  effectiveValue?: unknown
  sourceLabel?: string
  canFill: boolean
  canDelete: boolean
  canSelect: boolean
}

const props = defineProps<{
  abcText: string
  currentExtract: number
}>()

const emit = defineEmits<{
  intent: [intent: ConfigIntent]
}>()

const searchText = ref('')
const compactSyntax = ref(false)
const expandedPaths = ref<string[]>([
  'extract',
  'extract.current',
  'extract.current.layout',
  'extract.current.layout.packer',
  'extract.current.printer',
])
const draftValues = ref<Record<string, string>>({})

const treeDefinition: ConfigTreeDefinition[] = [
  {
    key: 'extract',
    label: 'Auszug',
    children: [
      {
        key: 'current',
        label: '0',
        children: [
          { key: 'title', label: 'Titel' },
          { key: 'voices', label: 'Stimmen' },
          { key: 'flowlines', label: 'Flowlines' },
          { key: 'subflowlines', label: 'Subflowlines' },
          { key: 'synchlines', label: 'Synchronisationslinien' },
          { key: 'layoutlines', label: 'Layoutstimmen' },
          { key: 'startpos', label: 'Startposition' },
          {
            key: 'layout',
            label: 'Layout',
            children: [
              { key: 'LINE_THIN', label: 'Linienstaerke duenn' },
              { key: 'LINE_MEDIUM', label: 'Linienstaerke mittel' },
              { key: 'LINE_THICK', label: 'Linienstaerke dick' },
              { key: 'ELLIPSE_SIZE', label: 'Notengroesse' },
              { key: 'REST_SIZE', label: 'Pausengroesse' },
              { key: 'X_SPACING', label: 'X-Abstand' },
              { key: 'X_OFFSET', label: 'X-Offset' },
              { key: 'PITCH_OFFSET', label: 'Pitch-Offset' },
              { key: 'DRAWING_AREA_SIZE', label: 'Zeichenflaeche' },
              {
                key: 'packer',
                label: 'Packer',
                children: [
                  { key: 'pack_method', label: 'Packmethode' },
                  { key: 'pack_max_spreadfactor', label: 'max. Spreizung' },
                  { key: 'pack_min_increment', label: 'min. Inkrement' },
                ],
              },
            ],
          },
          {
            key: 'printer',
            label: 'Druck',
            children: [
              { key: 'showBorder', label: 'Rahmen anzeigen' },
              { key: 'a3Offset', label: 'A3-Offset' },
              { key: 'a4Offset', label: 'A4-Offset' },
              { key: 'a4Pages', label: 'A4-Seiten' },
            ],
          },
          {
            key: 'barnumbers',
            label: 'Taktnummern',
            children: [
              { key: 'voices', label: 'Stimmen' },
              { key: 'pos', label: 'Position' },
              { key: 'style', label: 'Stil' },
            ],
          },
          {
            key: 'countnotes',
            label: 'Zaehlnoten',
            children: [
              { key: 'voices', label: 'Stimmen' },
              { key: 'pos', label: 'Position' },
              { key: 'style', label: 'Stil' },
            ],
          },
        ],
      },
    ],
  },
]

const parsedSongConfig = computed(() => {
  try {
    return {
      config: extractSongConfig(props.abcText),
      parseError: '',
    }
  } catch (error) {
    return {
      config: {},
      parseError: error instanceof Error ? error.message : String(error),
    }
  }
})

const defaultConfig = computed(() => initConf(new Confstack()))
const effectiveConfig = computed(() => mergeSongConfig(defaultConfig.value, parsedSongConfig.value.config))
const filteredSearch = computed(() => searchText.value.trim().toLowerCase())

const visibleRows = computed(() => buildVisibleRows())

watch(
  [() => props.currentExtract, () => props.abcText],
  () => {
    draftValues.value = {}
  },
)

function buildVisibleRows(): ConfigTreeRow[] {
  return flattenTree(treeDefinition)
}

function flattenTree(
  definitions: ConfigTreeDefinition[],
  parentPath = '',
  depth = 0,
): ConfigTreeRow[] {
  const rows: ConfigTreeRow[] = []

  for (const definition of definitions) {
    const path = joinPath(parentPath, definition.key)
    const branch = definition.children !== undefined && definition.children.length > 0
    const row = createRow(definition, path, depth, branch)
    const matches = matchesRow(row)
    const children = branch ? flattenTree(definition.children ?? [], path, depth + 1) : []
    const hasVisibleChildren = children.length > 0

    if (!matches && !hasVisibleChildren) {
      continue
    }

    rows.push(row)
    if (branch && (isExpanded(path) || filteredSearch.value !== '')) {
      rows.push(...children)
    }
  }

  return rows
}

function createRow(
  definition: ConfigTreeDefinition,
  path: string,
  depth: number,
  isBranch: boolean,
): ConfigTreeRow {
  const localPath = resolveLocalPath(path)
  const effectivePath = resolveEffectivePath(path)
  const localValue = localPath === undefined ? undefined : getPathValue(parsedSongConfig.value.config, localPath)
  const effectiveValue = effectivePath === undefined ? undefined : getPathValue(effectiveConfig.value, effectivePath)

  return {
    key: path,
    path,
    label: definition.label,
    depth,
    isBranch,
    isLeaf: !isBranch,
    localPath,
    effectivePath,
    localValue,
    effectiveValue,
    sourceLabel: resolveSourceLabel(localPath, effectivePath),
    canFill: !isBranch && localPath !== undefined && localValue === undefined && effectiveValue !== undefined,
    canDelete: localPath !== undefined && hasPathValue(parsedSongConfig.value.config, localPath),
    canSelect: canSelectPath(localPath),
  }
}

function joinPath(parentPath: string, key: string): string {
  return parentPath === '' ? key : `${parentPath}.${key}`
}

function resolveLocalPath(path: string): string | undefined {
  if (path === 'extract') return 'extract'
  if (path === 'extract.current') return `extract.${props.currentExtract}`
  if (path.startsWith('extract.current.')) {
    return path.replace('extract.current', `extract.${props.currentExtract}`)
  }
  return path
}

function resolveEffectivePath(path: string): string | undefined {
  return resolveLocalPath(path)
}

function resolveSourceLabel(localPath: string | undefined, effectivePath: string | undefined): string | undefined {
  if (effectivePath === undefined) return undefined
  if (localPath !== undefined && hasPathValue(parsedSongConfig.value.config, localPath)) {
    return localPath.startsWith(`extract.${props.currentExtract}`) ? `Auszug ${props.currentExtract}` : 'Dokument'
  }

  if (effectivePath.startsWith(`extract.${props.currentExtract}.`)) {
    const extractZeroPath = effectivePath.replace(`extract.${props.currentExtract}.`, 'extract.0.')
    if (hasPathValue(parsedSongConfig.value.config, extractZeroPath)) {
      return 'Auszug 0'
    }
  }

  return undefined
}

function matchesRow(row: ConfigTreeRow): boolean {
  if (filteredSearch.value === '') return true
  return row.label.toLowerCase().includes(filteredSearch.value)
    || row.path.toLowerCase().includes(filteredSearch.value)
}

function isExpanded(path: string): boolean {
  return expandedPaths.value.includes(path)
}

function toggleExpanded(path: string): void {
  expandedPaths.value = isExpanded(path)
    ? expandedPaths.value.filter(entry => entry !== path)
    : [...expandedPaths.value, path]
}

function formatValue(value: unknown): string {
  if (value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return compactSyntax.value ? formatCompactArray(value) : JSON.stringify(value)
  if (typeof value === 'object' && value !== null) return '{…}'
  return String(value)
}

function formatCompactArray(value: unknown[]): string {
  if (value.every(entry => typeof entry === 'number')) {
    return value.join(',')
  }

  if (value.every(entry => Array.isArray(entry) && entry.length === 2 && entry.every(item => typeof item === 'number'))) {
    return value
      .map(entry => `${(entry as unknown[])[0]}-${(entry as unknown[])[1]}`)
      .join(',,')
  }

  return JSON.stringify(value)
}

function getDraftValue(row: ConfigTreeRow): string {
  return draftValues.value[row.path] ?? formatValue(row.localValue)
}

function updateDraftValue(row: ConfigTreeRow, value: string): void {
  draftValues.value = {
    ...draftValues.value,
    [row.path]: value,
  }
}

function canSelectPath(path: string | undefined): boolean {
  if (path === undefined) return false
  return path.includes('.notebound.')
    || path.includes('.notes.')
    || path.includes('.annotations.')
}

function getPathValue(source: unknown, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = source
  for (const part of parts) {
    if (!isRecord(current) || !(part in current)) return undefined
    current = current[part]
  }
  return current
}

function hasPathValue(source: unknown, path: string): boolean {
  return getPathValue(source, path) !== undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function emitIntent(action: ConfigIntent['action'], path?: string): void {
  emit('intent', {
    action,
    path,
    extractId: props.currentExtract,
  })
}
</script>

<template>
  <ZnPanel
    title="Konfigurationseditor"
    :subtitle="`Baumansicht fuer Auszug ${props.currentExtract} mit wirksamen Werten und Platzhaltern fuer Commands.`"
    eyebrow="Phase 1 Stub"
    tone="accent"
  >
    <div class="config-panel">
      <ZnToolbar class="config-panel__toolbar">
        <template #leading>
          <ZnBadge tone="warning">Ausz. {{ props.currentExtract }}</ZnBadge>
          <ZnIconButton
            class="config-panel__toolbar-icon"
            label="Undo"
            variant="ghost"
            @click="emitIntent('config.undo')"
          >
            ↺
          </ZnIconButton>
          <ZnIconButton
            class="config-panel__toolbar-icon"
            label="Redo"
            variant="ghost"
            @click="emitIntent('config.redo')"
          >
            ↻
          </ZnIconButton>
        </template>
        <div class="config-panel__toolbar-search">
          <input
            v-model="searchText"
            class="config-panel__search-input"
            type="search"
            placeholder="Suche nach Pfad oder Parameter"
            aria-label="Suche nach Pfad oder Parameter"
          >
        </div>
        <template #trailing>
          <label class="config-panel__compact-toggle">
            <input v-model="compactSyntax" type="checkbox">
            <span>Kompakte Syntax</span>
          </label>
          <ZnButton variant="ghost" @click="emitIntent('config.quicksettings')">Schnelleinst.</ZnButton>
          <ZnButton variant="ghost" @click="emitIntent('config.addEntry')">Neuer Eintrag</ZnButton>
          <ZnButton variant="ghost" @click="emitIntent('config.openMainMenu')">Hauptmenue</ZnButton>
        </template>
      </ZnToolbar>

      <div v-if="parsedSongConfig.parseError" class="config-panel__parse-error" role="alert">
        {{ parsedSongConfig.parseError }}
      </div>

      <div class="config-panel__legend">
        <span>Lokaler Wert</span>
        <span>Wirksamer Wert</span>
      </div>

      <div class="config-panel__tree" role="tree" aria-label="Konfigurationsbaum">
        <div
          v-for="row in visibleRows"
          :key="row.key"
          class="config-row"
          :class="{
            'config-row--branch': row.isBranch,
            'config-row--leaf': row.isLeaf,
          }"
          :style="{ '--config-depth': row.depth }"
          role="treeitem"
          :aria-expanded="row.isBranch ? isExpanded(row.path) : undefined"
        >
          <div class="config-row__name">
            <ZnIconButton
              v-if="row.isBranch"
              class="config-row__toggle"
              :label="isExpanded(row.path) ? 'Teilbaum einklappen' : 'Teilbaum ausklappen'"
              variant="ghost"
              @click="toggleExpanded(row.path)"
            >
              {{ isExpanded(row.path) ? 'v' : '>' }}
            </ZnIconButton>
            <span v-else class="config-row__toggle-spacer" aria-hidden="true" />
            <div class="config-row__name-copy" :title="row.localPath ?? row.path">
              <span class="config-row__label">{{ row.label }}</span>
            </div>
          </div>

          <div class="config-row__value">
            <input
              v-if="row.isLeaf"
              :value="getDraftValue(row)"
              class="config-row__input"
              type="text"
              :placeholder="row.canFill ? 'Mit wirksamem Wert auffuellen' : 'Kein lokaler Wert'"
              @input="updateDraftValue(row, ($event.target as HTMLInputElement).value)"
            >
          </div>

          <div class="config-row__actions">
            <ZnIconButton
              class="config-row__action"
              label="Betroffenes Objekt selektieren"
              variant="ghost"
              :disabled="!row.canSelect"
              @click="emitIntent('config.selectAffectedObject', row.localPath)"
            >
              ◎
            </ZnIconButton>
            <ZnIconButton
              class="config-row__action"
              label="Parameter mit wirksamem Wert auffuellen"
              variant="ghost"
              :disabled="!row.canFill"
              @click="emitIntent('config.fillPath', row.localPath)"
            >
              ⤓
            </ZnIconButton>
            <ZnIconButton
              class="config-row__action"
              label="Parametermenue oeffnen"
              variant="ghost"
              :title="row.localPath ?? row.path"
              @click="emitIntent('config.openMenuAtPath', row.localPath)"
            >
              ≡
            </ZnIconButton>
            <ZnIconButton
              class="config-row__action"
              label="Pfad oder Teilbaum loeschen"
              variant="ghost"
              :disabled="!row.canDelete"
              @click="emitIntent('config.deletePath', row.localPath)"
            >
              ⌫
            </ZnIconButton>
            <button class="config-row__help" type="button" :title="row.sourceLabel ? `Wirksam aus ${row.sourceLabel}` : 'Noch keine Herkunft aufgeloest'">
              ?
            </button>
          </div>

          <div v-if="row.isLeaf" class="config-row__effective">
            <span class="config-row__effective-value">{{ formatValue(row.effectiveValue) }}</span>
            <span v-if="row.sourceLabel" class="config-row__source">{{ row.sourceLabel }}</span>
          </div>
        </div>
      </div>
    </div>
  </ZnPanel>
</template>

<style scoped>
.config-panel {
  display: grid;
  gap: var(--zn-space-2);
  min-height: 0;
  height: 100%;
  font-size: 0.82rem;
}

.config-panel__toolbar {
  position: sticky;
  top: 0;
  z-index: 1;
}

.config-panel__toolbar:deep(.zn-toolbar) {
  gap: var(--zn-space-2);
  padding: 0.18rem 0.28rem;
}

.config-panel__toolbar:deep(.zn-button) {
  min-height: 1.8rem;
  padding: 0.2rem 0.55rem;
  font-size: 0.78rem;
}

:deep(.config-panel__toolbar .zn-badge) {
  display: inline-flex;
  padding: 0.08rem 0.38rem;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1;
  white-space: nowrap;
}

:deep(.config-panel__toolbar-icon.zn-icon-button) {
  width: 1.3rem;
  height: 1.3rem;
  border-radius: 999px;
  box-shadow: none;
  font-size: 0.72rem;
}

.config-panel__toolbar-search {
  flex: 1 1 auto;
  min-width: 10rem;
}

.config-panel__search-input {
  width: 100%;
  min-height: 1.8rem;
  padding: 0.24rem 0.55rem;
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-md);
  background: color-mix(in srgb, var(--zn-bg-surface) 90%, white);
  color: var(--zn-text);
  font: inherit;
}

.config-panel__search-input:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--zn-accent) 60%, white);
  outline-offset: 2px;
}

.config-panel__compact-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  color: var(--zn-text-soft);
  font-size: 0.76rem;
  white-space: nowrap;
}

.config-panel__parse-error {
  padding: 0.8rem 0.9rem;
  border: 1px solid color-mix(in srgb, var(--zn-danger) 35%, transparent);
  border-radius: var(--zn-radius-md);
  background: color-mix(in srgb, var(--zn-danger) 10%, var(--zn-bg-surface));
  color: var(--zn-danger);
  font-size: 0.84rem;
}

.config-panel__legend {
  display: grid;
  grid-template-columns: minmax(15rem, 2.4fr) minmax(9rem, 1fr) auto minmax(7rem, 0.8fr);
  gap: 0.35rem;
  padding: 0 0.35rem;
  color: var(--zn-text-soft);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.config-panel__tree {
  display: grid;
  align-content: start;
  gap: 0;
  min-height: 0;
  overflow: auto;
  padding-right: 0.05rem;
  border: 1px solid color-mix(in srgb, var(--zn-border) 82%, transparent);
  border-radius: var(--zn-radius-md);
  background: color-mix(in srgb, var(--zn-bg-surface) 92%, white);
}

.config-row {
  --indent-size: calc(var(--config-depth) * 0.8rem);
  display: grid;
  grid-template-columns: minmax(15rem, 2.4fr) minmax(9rem, 1fr) auto minmax(7rem, 0.8fr);
  gap: 0.35rem;
  align-items: start;
  min-height: 1.7rem;
  padding: 0.12rem 0.35rem;
  border-top: 1px solid color-mix(in srgb, var(--zn-border) 72%, transparent);
  background: transparent;
}

.config-row:first-child {
  border-top: none;
}

.config-row--branch {
  background: color-mix(in srgb, var(--zn-accent) 4%, var(--zn-bg-surface));
}

.config-row:hover {
  background: color-mix(in srgb, var(--zn-accent) 6%, var(--zn-bg-surface));
}

.config-row__name {
  display: flex;
  align-items: flex-start;
  gap: 0.28rem;
  min-width: 0;
  padding-left: var(--indent-size);
  padding-top: 0.08rem;
}

.config-row__toggle,
.config-row__toggle-spacer {
  flex: 0 0 auto;
  align-self: center;
}

.config-row__toggle-spacer {
  width: 0.92rem;
  height: 0.92rem;
}

:deep(.config-row__toggle.zn-icon-button) {
  width: 0.92rem;
  height: 0.92rem;
  border-radius: 0.22rem;
  box-shadow: none;
  font-size: 0.58rem;
  line-height: 1;
  padding: 0;
}

:deep(.config-row__toggle.zn-icon-button:focus-visible) {
  outline-offset: 0;
}

.config-row__name-copy {
  display: flex;
  align-items: flex-start;
  min-width: 0;
  min-height: 1.35rem;
}

.config-row__label {
  color: var(--zn-heading);
  font-size: 0.83rem;
  font-weight: 700;
  line-height: 1.15;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-row__value {
  min-width: 0;
}

.config-row__value {
  padding-top: 0.04rem;
}

.config-row__input,
.config-row__object-placeholder {
  width: 100%;
  min-height: 1.35rem;
  padding: 0.08rem 0.38rem;
  border: 1px solid var(--zn-border);
  border-radius: 0.45rem;
  background: color-mix(in srgb, var(--zn-bg-surface) 86%, white);
  color: var(--zn-text);
  font: inherit;
  line-height: 1.1;
  box-sizing: border-box;
}

.config-row__input {
  font-family: var(--zn-font-mono);
}

.config-row__input:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--zn-accent) 60%, white);
  outline-offset: 2px;
}

.config-row__object-placeholder {
  display: inline-flex;
  align-items: center;
  color: var(--zn-text-muted);
  font-size: 0.72rem;
}

.config-row__actions {
  display: inline-flex;
  align-items: flex-start;
  gap: 0.08rem;
  padding-inline: 0.06rem;
  padding-top: 0.02rem;
}

.config-row__effective {
  display: grid;
  gap: 0.02rem;
  align-content: start;
  min-width: 0;
  padding-top: 0.08rem;
}

.config-row__effective-value {
  color: var(--zn-heading);
  font-family: var(--zn-font-mono);
  font-size: 0.72rem;
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-row__source {
  display: inline-flex;
  width: fit-content;
  padding: 0.08rem 0.35rem;
  border: 1px solid color-mix(in srgb, var(--zn-warning) 44%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--zn-warning) 16%, white);
  color: color-mix(in srgb, var(--zn-heading) 82%, var(--zn-warning) 18%);
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1.1;
  text-transform: none;
  white-space: nowrap;
}

:deep(.config-row__action.zn-icon-button) {
  width: 1.45rem;
  height: 1.45rem;
  border-radius: 0.42rem;
  box-shadow: none;
  font-size: 0.76rem;
}

.config-row__help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.2rem;
  height: 1.2rem;
  border: 1px solid var(--zn-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--zn-bg-surface) 84%, white);
  color: var(--zn-text-soft);
  font-size: 0.58rem;
  font-weight: 700;
  cursor: help;
}

@media (max-width: 1100px) {
  .config-panel__legend {
    display: none;
  }

  .config-row {
    grid-template-columns: 1fr;
    gap: 0.2rem;
  }

  .config-row__actions {
    order: 4;
  }
}
</style>
