<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import 'tippy.js/dist/tippy.css'

import {
  CONFIG_EDITOR_MENU_ITEMS,
  Confstack,
  extractSongConfig,
  getConfigPathActionProfile,
  getConfigEditorFormSet,
  initConf,
  LEGACY_BARNUMBERS_EXTRACT_PATH_SUFFIXES,
  LEGACY_COUNTNOTES_EXTRACT_PATH_SUFFIXES,
  LEGACY_LAYOUT_EXTRACT_PATH_SUFFIXES,
  LEGACY_LAYOUT_PACKER_EXTRACT_PATH_SUFFIXES,
  LEGACY_LYRICS_EXTRACT_PATH_SUFFIX_PATTERNS,
  LEGACY_NOTES_EXTRACT_PATH_SUFFIXES,
  LEGACY_PRINTER_EXTRACT_PATH_SUFFIXES,
  LEGACY_STRINGNAMES_EXTRACT_PATH_SUFFIXES,
  mergeSongConfig,
  type ConfigEditorMenuCommand,
} from '@zupfnoter/core'

import ZnBadge from '../../design-system/components/ZnBadge.vue'
import ZnButton from '../../design-system/components/ZnButton.vue'
import ZnIconButton from '../../design-system/components/ZnIconButton.vue'
import ZnPanel from '../../design-system/components/ZnPanel.vue'
import ZnToolbar from '../../design-system/components/ZnToolbar.vue'
import { loadConfigHelpTexts, resolveConfigHelpHtml, type ConfigHelpTexts } from './configHelp'

interface ConfigIntent {
  action:
    | 'config.undo'
    | 'config.redo'
    | 'config.quicksettings'
    | 'config.addEntry'
    | 'config.openMainMenu'
    | 'config.editSection'
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

interface PathLabelDefinition {
  pathSuffix: string
  label: string
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
  hasExtractZeroMarker: boolean
  canFill: boolean
  canDelete: boolean
  canSelect: boolean
  menuKind: string
}

const props = defineProps<{
  abcText: string
  currentExtract: number
  activeSection: string
}>()

const emit = defineEmits<{
  intent: [intent: ConfigIntent]
}>()

const searchText = ref('')
const panelElement = ref<HTMLElement | null>(null)
const configMenuElement = ref<HTMLDetailsElement | null>(null)
const panelWidth = ref(1400)
const expandedPaths = ref<string[]>([
  'extract',
  'extract.current',
  'extract.current.layout',
  'extract.current.layout.packer',
  'extract.current.printer',
])
const draftValues = ref<Record<string, string>>({})

const fallbackSectionVisiblePaths: Record<string, string[]> = {
  layout: [
    'extract.current.layout',
  ],
  instrument_specific: [
    'extract.current.layout.X_SPACING',
    'extract.current.layout.X_OFFSET',
    'extract.current.layout.PITCH_OFFSET',
    'extract.current.layout.DRAWING_AREA_SIZE',
  ],
  barnumbers_countnotes: [
    'extract.current.barnumbers',
    'extract.current.countnotes',
  ],
  notes: [
    'extract.current.legend',
    'extract.current.notes',
  ],
  lyrics: [
    'extract.current.lyrics',
  ],
  printer: [
    'extract.current.printer',
  ],
  stringnames: [
    'extract.current.stringnames',
  ],
}

const layoutTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'layout.LINE_THIN', label: 'Linienstaerke duenn' },
  { pathSuffix: 'layout.LINE_MEDIUM', label: 'Linienstaerke mittel' },
  { pathSuffix: 'layout.LINE_THICK', label: 'Linienstaerke dick' },
  { pathSuffix: 'layout.ELLIPSE_SIZE', label: 'Notengroesse' },
  { pathSuffix: 'layout.REST_SIZE', label: 'Pausengroesse' },
  { pathSuffix: 'layout.X_SPACING', label: 'X-Abstand' },
  { pathSuffix: 'layout.X_OFFSET', label: 'X-Offset' },
  { pathSuffix: 'layout.PITCH_OFFSET', label: 'Pitch-Offset' },
  { pathSuffix: 'layout.DRAWING_AREA_SIZE', label: 'Zeichenflaeche' },
]

const printerTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'printer.show_border', label: 'Rahmen anzeigen' },
  { pathSuffix: 'printer.a3_offset', label: 'A3-Offset' },
  { pathSuffix: 'printer.a4_offset', label: 'A4-Offset' },
  { pathSuffix: 'printer.a4_pages', label: 'A4-Seiten' },
]

const packerTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'layout.packer.pack_method', label: 'Packmethode' },
  { pathSuffix: 'layout.packer.pack_max_spreadfactor', label: 'max. Spreizung' },
  { pathSuffix: 'layout.packer.pack_min_increment', label: 'min. Inkrement' },
]

const barnumbersTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'barnumbers.voices', label: 'Stimmen' },
  { pathSuffix: 'barnumbers.pos', label: 'Position' },
  { pathSuffix: 'barnumbers.style', label: 'Stil' },
]

const countnotesTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'countnotes.voices', label: 'Stimmen' },
  { pathSuffix: 'countnotes.pos', label: 'Position' },
  { pathSuffix: 'countnotes.style', label: 'Stil' },
]

const notesTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'legend.pos', label: 'Legende Position' },
  { pathSuffix: 'legend.align', label: 'Legende Ausrichtung' },
  { pathSuffix: 'legend.spos', label: 'Legende Startposition' },
  { pathSuffix: 'notes', label: 'Seitenbeschriftung' },
]

const lyricsTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'lyrics.*.verses', label: 'Strophen' },
  { pathSuffix: 'lyrics.*.pos', label: 'Position' },
  { pathSuffix: 'lyrics.*.style', label: 'Stil' },
]

const stringnamesTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'stringnames', label: 'Saitennamen' },
  { pathSuffix: 'stringnames.text', label: 'Text' },
  { pathSuffix: 'stringnames.vpos', label: 'Stimmen' },
  { pathSuffix: 'stringnames.marks.hpos', label: 'Marker horizontal' },
  { pathSuffix: 'stringnames.marks.vpos', label: 'Marker vertikal' },
]

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
              ...mapTreeDefinitionsForPrefix(
                LEGACY_LAYOUT_EXTRACT_PATH_SUFFIXES,
                'layout.',
                layoutTreeLeafDefinitions,
              ),
              {
                key: 'packer',
                label: 'Packer',
                children: mapTreeDefinitionsForPrefix(
                  LEGACY_LAYOUT_PACKER_EXTRACT_PATH_SUFFIXES,
                  'layout.packer.',
                  packerTreeLeafDefinitions,
                ),
              },
            ],
          },
          {
            key: 'printer',
            label: 'Druck',
            children: mapTreeDefinitionsForPrefix(
              LEGACY_PRINTER_EXTRACT_PATH_SUFFIXES,
              'printer.',
              printerTreeLeafDefinitions,
            ),
          },
          {
            key: 'barnumbers',
            label: 'Taktnummern',
            children: mapTreeDefinitionsForPrefix(
              LEGACY_BARNUMBERS_EXTRACT_PATH_SUFFIXES,
              'barnumbers.',
              barnumbersTreeLeafDefinitions,
            ),
          },
          {
            key: 'countnotes',
            label: 'Zaehlnoten',
            children: mapTreeDefinitionsForPrefix(
              LEGACY_COUNTNOTES_EXTRACT_PATH_SUFFIXES,
              'countnotes.',
              countnotesTreeLeafDefinitions,
            ),
          },
          {
            key: 'legend',
            label: 'Legende',
            children: mapTreeDefinitionsForPrefix(
              LEGACY_NOTES_EXTRACT_PATH_SUFFIXES,
              'legend.',
              notesTreeLeafDefinitions,
            ),
          },
          {
            key: 'notes',
            label: 'Seitenbeschriftung',
          },
          {
            key: 'lyrics',
            label: 'Liedtexte',
            children: mapTreeDefinitionsForWildcardPrefix(
              LEGACY_LYRICS_EXTRACT_PATH_SUFFIX_PATTERNS,
              'lyrics.*.',
              lyricsTreeLeafDefinitions,
            ),
          },
          {
            key: 'stringnames',
            label: 'Saitennamen',
            children: mapTreeDefinitionsForPrefix(
              LEGACY_STRINGNAMES_EXTRACT_PATH_SUFFIXES,
              'stringnames.',
              stringnamesTreeLeafDefinitions,
            ),
          },
        ],
      },
    ],
  },
]

function mapTreeDefinitionsForPrefix(
  pathSuffixes: readonly string[],
  prefix: string,
  labels: readonly PathLabelDefinition[],
): ConfigTreeDefinition[] {
  const labelMap = new Map(labels.map((entry) => [entry.pathSuffix, entry.label]))
  return pathSuffixes
    .filter((pathSuffix) => {
      if (!pathSuffix.startsWith(prefix)) return false
      if (pathSuffix.includes('.packer.')) return false
      return labelMap.has(pathSuffix)
    })
    .map((pathSuffix) => ({
      key: pathSuffix.slice(prefix.length),
      label: labelMap.get(pathSuffix) ?? pathSuffix.slice(prefix.length),
    }))
}

function mapTreeDefinitionsForWildcardPrefix(
  pathSuffixes: readonly string[],
  prefix: string,
  labels: readonly PathLabelDefinition[],
): ConfigTreeDefinition[] {
  const labelMap = new Map(labels.map((entry) => [entry.pathSuffix, entry.label]))
  return pathSuffixes
    .filter((pathSuffix) => pathSuffix.startsWith(prefix) && labelMap.has(pathSuffix))
    .map((pathSuffix) => ({
      key: pathSuffix.slice(prefix.length),
      label: labelMap.get(pathSuffix) ?? pathSuffix.slice(prefix.length),
    }))
}

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
const activeSectionSearch = computed(() => getConfigEditorFormSet(props.activeSection) === undefined
  ? props.activeSection.trim().toLowerCase()
  : '')
const effectiveSearch = computed(() => filteredSearch.value === '' ? activeSectionSearch.value : filteredSearch.value)

const visibleRows = computed(() => buildVisibleRows())
const usesCompactShell = computed(() => visibleRows.value.length <= 4)
let panelResizeObserver: ResizeObserver | undefined
const helpTooltips = new Map<HTMLElement, TippyInstance>()
const configHelpTexts = ref<ConfigHelpTexts>({})

watch(
  [() => props.currentExtract, () => props.abcText],
  () => {
    draftValues.value = {}
  },
)

watch(
  visibleRows,
  () => {
    void nextTick(() => {
      syncHelpTooltips()
    })
  },
  { deep: true },
)

watch(
  () => props.activeSection,
  (section) => {
    expandSection(section)
    searchText.value = ''
  },
  { immediate: true },
)

onMounted(() => {
  syncPanelWidth()
  if (typeof ResizeObserver !== 'undefined') {
    panelResizeObserver = new ResizeObserver(() => {
      syncPanelWidth()
    })
    if (panelElement.value !== null) {
      panelResizeObserver.observe(panelElement.value)
    }
  }
  void loadConfigHelpTexts().then((texts) => {
    configHelpTexts.value = texts
    syncHelpTooltips()
  })
  void nextTick(() => {
    syncHelpTooltips()
  })
})

onBeforeUnmount(() => {
  panelResizeObserver?.disconnect()
  destroyHelpTooltips()
})

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
    if (!isVisibleInActiveSection(path)) {
      continue
    }
    const branch = definition.children !== undefined && definition.children.length > 0
    const row = createRow(definition, path, depth, branch)
    const matches = matchesRow(row)
    const children = branch ? flattenTree(definition.children ?? [], path, depth + 1) : []
    const hasVisibleChildren = children.length > 0

    if (!matches && !hasVisibleChildren) {
      continue
    }

    rows.push(row)
    if (branch && (isExpanded(path) || effectiveSearch.value !== '')) {
      rows.push(...children)
    }
  }

  return rows
}

function isVisibleInActiveSection(path: string): boolean {
  const visiblePaths = resolveSectionVisiblePaths()
  if (visiblePaths === undefined || visiblePaths.includes('.')) return true
  return visiblePaths.some((visiblePath) => visiblePath.startsWith(path) || path.startsWith(visiblePath))
}

function expandSection(section: string): void {
  const visiblePaths = resolveSectionVisiblePaths(section)
  if (visiblePaths === undefined || visiblePaths.includes('.')) return
  const nextExpanded = new Set(expandedPaths.value)
  for (const visiblePath of visiblePaths) {
    for (const ancestor of getPathAncestors(visiblePath)) {
      nextExpanded.add(ancestor)
    }
  }
  expandedPaths.value = [...nextExpanded]
}

function resolveSectionVisiblePaths(section = props.activeSection): string[] | undefined {
  const formSet = getConfigEditorFormSet(section)
  const visiblePaths = formSet?.keys.map(configEditorKeyToTreePath)
  if (visiblePaths === undefined) {
    const directPath = configEditorKeyToTreePath(section)
    return pathExistsInTree(directPath) ? [directPath] : undefined
  }
  if (visiblePaths.includes('.') || visiblePaths.some((path) => pathExistsInTree(path))) {
    return visiblePaths
  }
  return fallbackSectionVisiblePaths[section] ?? visiblePaths
}

function configEditorKeyToTreePath(key: string): string {
  return key.replace(/^extract\.(\{extract\}|\d+)(?=\.|$)/, 'extract.current')
}

function rowMatchesActiveSection(row: ConfigTreeRow): boolean {
  if (activeSectionSearch.value === '') return true
  if (filteredSearch.value !== '') return true
  if (row.label.toLowerCase().includes(activeSectionSearch.value)) return true
  if (row.path.toLowerCase().includes(activeSectionSearch.value)) return true
  const localPath = row.localPath
  return localPath === undefined ? false : localPath.toLowerCase().includes(activeSectionSearch.value)
}

function rowMatchesTypedSearch(row: ConfigTreeRow): boolean {
  if (filteredSearch.value === '') return true
  return row.label.toLowerCase().includes(filteredSearch.value)
    || row.path.toLowerCase().includes(filteredSearch.value)
    || (row.localPath?.toLowerCase().includes(filteredSearch.value) ?? false)
}

function pathExistsInTree(path: string): boolean {
  return findDefinitionByPath(treeDefinition, path) !== undefined
}

function findDefinitionByPath(
  definitions: ConfigTreeDefinition[],
  path: string,
  parentPath = '',
): ConfigTreeDefinition | undefined {
  for (const definition of definitions) {
    const currentPath = joinPath(parentPath, definition.key)
    if (currentPath === path) return definition
    const found = definition.children === undefined
      ? undefined
      : findDefinitionByPath(definition.children, path, currentPath)
    if (found !== undefined) return found
  }
  return undefined
}

function getPathAncestors(path: string): string[] {
  const parts = path.split('.')
  const ancestors: string[] = []
  for (let index = 1; index < parts.length; index += 1) {
    ancestors.push(parts.slice(0, index).join('.'))
  }
  return ancestors
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
  const extractZeroValue = effectivePath === undefined ? undefined : getExtractZeroValue(effectivePath)
  const actionProfile = getConfigPathActionProfile(localPath, {
    hasEffectiveValue: effectiveValue !== undefined,
    hasLocalValue: localValue !== undefined,
    isLeaf: !isBranch,
  })

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
    hasExtractZeroMarker: hasExtractZeroMarker(localPath, localValue, extractZeroValue),
    canFill: actionProfile.canFill,
    canDelete: actionProfile.canDelete,
    canSelect: actionProfile.canSelect,
    menuKind: actionProfile.menuKind,
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

function getExtractZeroValue(effectivePath: string): unknown {
  if (!effectivePath.startsWith(`extract.${props.currentExtract}.`)) {
    return undefined
  }
  const extractZeroPath = effectivePath.replace(`extract.${props.currentExtract}.`, 'extract.0.')
  return getPathValue(parsedSongConfig.value.config, extractZeroPath)
}

function hasExtractZeroMarker(
  localPath: string | undefined,
  localValue: unknown,
  extractZeroValue: unknown,
): boolean {
  if (props.currentExtract === 0) return false
  if (localPath === undefined || localValue === undefined || extractZeroValue === undefined) return false
  if (!localPath.startsWith(`extract.${props.currentExtract}.`)) return false
  return areValuesEqual(localValue, extractZeroValue)
}

function matchesRow(row: ConfigTreeRow): boolean {
  return rowMatchesActiveSection(row) && rowMatchesTypedSearch(row)
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
  if (Array.isArray(value)) return formatCompactArray(value)
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

function syncPanelWidth(): void {
  panelWidth.value = panelElement.value?.clientWidth ?? 1400
}

function syncHelpTooltips(): void {
  if (panelElement.value === null) return
  const elements = panelElement.value.querySelectorAll<HTMLElement>('.config-row__help[data-help-key]')

  for (const element of elements) {
    const helpKey = element.dataset.helpKey
    if (helpKey === undefined) continue
    const existing = helpTooltips.get(element)
    if (existing !== undefined) {
      existing.setContent(createHelpTooltipContent(helpKey))
      continue
    }
    const instance = tippy(element, {
      content: createHelpTooltipContent(helpKey),
      allowHTML: true,
      interactive: true,
      trigger: 'mouseenter click',
      hideOnClick: true,
      theme: 'zn-config-help',
      maxWidth: 320,
      placement: 'left-start',
    })
    helpTooltips.set(element, instance)
  }

  for (const [element, instance] of helpTooltips) {
    if (panelElement.value.contains(element)) continue
    instance.destroy()
    helpTooltips.delete(element)
  }
}

function destroyHelpTooltips(): void {
  for (const instance of helpTooltips.values()) {
    instance.destroy()
  }
  helpTooltips.clear()
}

function createHelpTooltipContent(helpKey: string): HTMLElement {
  const container = document.createElement('div')
  container.className = 'config-help-tooltip'

  const path = document.createElement('div')
  path.className = 'config-help-tooltip__path'
  const resolvedPath = resolveLocalPath(helpKey) ?? helpKey
  path.textContent = resolvedPath
  container.append(path)

  const body = document.createElement('div')
  body.className = 'config-help-tooltip__body'
  body.innerHTML = resolveConfigHelpHtml(resolvedPath, configHelpTexts.value)
    ?? '<p>Noch keine Hilfebeschreibung vorhanden.</p>'
  container.append(body)

  return container
}

function displayLabel(label: string, depth: number): string {
  const maxLength = estimateLabelCapacity(depth)
  if (label.length <= maxLength) return label
  return abbreviateMiddle(label, maxLength)
}

function estimateLabelCapacity(depth: number): number {
  const reservedWidth = 224 + 108 + 96 + 22
  const estimatedNameColumnWidth = Math.max(128, panelWidth.value - reservedWidth)
  const indentationWidth = depth * 13 + 26
  const labelWidth = Math.max(52, estimatedNameColumnWidth - indentationWidth)
  return Math.max(7, Math.floor(labelWidth / 8.2))
}

function abbreviateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  const visibleCharacters = Math.max(4, maxLength - 3)
  const headLength = Math.max(2, Math.ceil(visibleCharacters / 2))
  const tailLength = Math.max(2, Math.floor(visibleCharacters / 2))
  return `${value.slice(0, headLength)}...${value.slice(-tailLength)}`
}

function isAbbreviatedLabel(label: string, depth: number): boolean {
  return displayLabel(label, depth) !== label
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

function areValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
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

function selectConfigMenuItem(item: ConfigEditorMenuCommand): void {
  if (configMenuElement.value !== null) {
    configMenuElement.value.open = false
  }
  emitIntent('config.editSection', item.id)
}
</script>

<template>
  <div class="config-panel-frame" :class="{ 'config-panel-frame--compact': usesCompactShell }">
    <ZnPanel :fill-height="!usesCompactShell">
      <div ref="panelElement" class="config-panel" :class="{ 'config-panel--compact': usesCompactShell }">
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
          <ZnButton variant="ghost" @click="emitIntent('config.quicksettings')">Schnelleinst.</ZnButton>
          <ZnButton variant="ghost" @click="emitIntent('config.addEntry')">Neuer Eintrag</ZnButton>
          <details ref="configMenuElement" class="config-panel__main-menu">
            <summary
              class="config-panel__main-menu-summary"
              aria-haspopup="menu"
            >
              <span class="config-panel__main-menu-icon" aria-hidden="true">✎</span>
              <span>Konfig. bearb.</span>
              <span class="config-panel__main-menu-caret" aria-hidden="true">v</span>
            </summary>
            <div class="config-panel__main-menu-list" role="menu" aria-label="Konfiguration bearbeiten">
              <template v-for="(item, index) in CONFIG_EDITOR_MENU_ITEMS" :key="item.type === 'command' ? item.id : `separator-${index}`">
                <div v-if="item.type === 'separator'" class="config-panel__main-menu-separator" role="separator" />
                <button
                  v-else
                  class="config-panel__main-menu-item"
                  type="button"
                  role="menuitem"
                  :title="item.title"
                  @click="selectConfigMenuItem(item)"
                >
                  <span
                    class="config-panel__main-menu-item-icon"
                    :class="item.legacyIcon.split(' ')"
                    :data-legacy-icon="item.legacyIcon"
                    aria-hidden="true"
                  />
                  {{ item.label }}
                </button>
              </template>
            </div>
          </details>
        </template>
      </ZnToolbar>

      <div v-if="parsedSongConfig.parseError" class="config-panel__parse-error" role="alert">
        {{ parsedSongConfig.parseError }}
      </div>

      <div
        class="config-panel__tree"
        :class="{ 'config-panel__tree--compact': usesCompactShell }"
        :style="{ '--config-visible-rows': visibleRows.length }"
        role="tree"
        aria-label="Konfigurationsbaum"
      >
        <div v-if="visibleRows.length === 0" class="config-panel__empty">
          Keine passenden Parameter
        </div>
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
              <span
                class="config-row__label"
                :class="{ 'config-row__label--compact': isAbbreviatedLabel(row.label, row.depth) }"
              >
                {{ displayLabel(row.label, row.depth) }}
              </span>
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
              :tabindex="-1"
              @click="emitIntent('config.selectAffectedObject', row.localPath)"
            >
              ◎
            </ZnIconButton>
            <ZnIconButton
              class="config-row__action"
              label="Parameter mit wirksamem Wert auffuellen"
              variant="ghost"
              :disabled="!row.canFill"
              :tabindex="-1"
              @click="emitIntent('config.fillPath', row.localPath)"
            >
              ⤓
            </ZnIconButton>
            <ZnIconButton
              class="config-row__action"
              label="Parametermenue oeffnen"
              variant="ghost"
              :title="row.localPath ?? row.path"
              :tabindex="-1"
              @click="emitIntent('config.openMenuAtPath', row.localPath)"
            >
              ≡
            </ZnIconButton>
            <ZnIconButton
              class="config-row__action"
              label="Pfad oder Teilbaum loeschen"
              variant="ghost"
              :disabled="!row.canDelete"
              :tabindex="-1"
              @click="emitIntent('config.deletePath', row.localPath)"
            >
              ⌫
            </ZnIconButton>
            <button
              class="config-row__help"
              type="button"
              tabindex="-1"
              :data-help-key="row.localPath ?? row.path"
            >
              ?
            </button>
          </div>

          <div v-if="row.isLeaf" class="config-row__effective">
            <div class="config-row__effective-main">
              <span
                class="config-row__effective-value"
                :title="formatValue(row.effectiveValue)"
              >
                {{ formatValue(row.effectiveValue) }}
              </span>
              <span
                v-if="row.hasExtractZeroMarker"
                class="config-row__effective-marker"
                title="Lokaler Wert entspricht Auszug 0"
              >
                =
              </span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </ZnPanel>
  </div>
</template>

<style scoped>
.config-panel-frame {
  height: 100%;
  min-height: 0;
}

.config-panel-frame:deep(.zn-panel),
.config-panel-frame:deep(.zn-panel__shell),
.config-panel-frame:deep(.zn-panel__body) {
  overflow: visible;
}

.config-panel-frame--compact {
  height: auto;
  align-self: start;
}

.config-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--zn-space-2);
  min-height: 0;
  height: 100%;
  font-size: 0.82rem;
}

.config-panel--compact {
  grid-template-rows: auto auto;
  height: auto;
  min-height: auto;
}

.config-panel__toolbar {
  position: sticky;
  top: 0;
  z-index: 1;
}

.config-panel__toolbar:deep(.zn-toolbar) {
  box-sizing: border-box;
  height: 2.08rem;
  min-height: 2.08rem;
  max-height: 2.08rem;
  gap: var(--zn-space-2);
  padding: 0.18rem 0.28rem;
  overflow: visible;
  flex-wrap: nowrap;
}

.config-panel__toolbar:deep(.zn-button) {
  min-height: 1.52rem;
  padding: 0.12rem 0.48rem;
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
  width: 1.22rem;
  height: 1.22rem;
  border-radius: 999px;
  box-shadow: none;
  font-size: 0.72rem;
}

.config-panel__toolbar-search {
  flex: 1 1 auto;
  min-width: 10rem;
}

.config-panel__main-menu {
  position: relative;
}

.config-panel__main-menu-summary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 1.52rem;
  padding: 0.12rem 0.48rem;
  border: 1px solid transparent;
  border-radius: var(--zn-radius-md);
  color: var(--zn-text-soft);
  font-size: 0.78rem;
  cursor: pointer;
  list-style: none;
  white-space: nowrap;
}

.config-panel__main-menu-summary::-webkit-details-marker {
  display: none;
}

.config-panel__main-menu-summary:hover {
  border-color: var(--zn-border);
  background: var(--zn-bg-surface-soft);
}

.config-panel__main-menu-summary:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--zn-accent) 65%, white);
  outline-offset: 2px;
}

.config-panel__main-menu-icon,
.config-panel__main-menu-caret {
  color: var(--zn-text-muted);
  font-size: 0.74rem;
  line-height: 1;
}

.config-panel__main-menu-list {
  position: absolute;
  top: calc(100% + 0.3rem);
  right: 0;
  z-index: 40;
  display: grid;
  gap: 0.08rem;
  min-width: 14rem;
  padding: 0.28rem;
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-md);
  background: var(--zn-bg-surface);
  box-shadow: var(--zn-shadow-soft);
}

.config-panel__main-menu-item {
  display: flex;
  align-items: center;
  gap: 0.46rem;
  width: 100%;
  padding: 0.34rem 0.46rem;
  border: 0;
  border-radius: var(--zn-radius-sm);
  background: transparent;
  color: var(--zn-text);
  font: inherit;
  font-size: 0.76rem;
  line-height: 1.15;
  text-align: left;
  cursor: pointer;
}

.config-panel__main-menu-item-icon {
  flex: 0 0 1rem;
  width: 1rem;
  color: var(--zn-text-muted);
  font-size: 0.78rem;
  line-height: 1;
  text-align: center;
}

.config-panel__main-menu-item:hover,
.config-panel__main-menu-item:focus-visible {
  background: var(--zn-bg-surface-soft);
  outline: none;
}

.config-panel__main-menu-separator {
  height: 1px;
  margin: 0.18rem 0.24rem;
  background: color-mix(in srgb, var(--zn-border) 76%, transparent);
}

.config-panel__search-input {
  width: 100%;
  height: 1.52rem;
  min-height: 1.52rem;
  padding: 0.12rem 0.5rem;
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

.config-panel__parse-error {
  padding: 0.8rem 0.9rem;
  border: 1px solid color-mix(in srgb, var(--zn-danger) 35%, transparent);
  border-radius: var(--zn-radius-md);
  background: color-mix(in srgb, var(--zn-danger) 10%, var(--zn-bg-surface));
  color: var(--zn-danger);
  font-size: 0.84rem;
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

.config-panel__tree--compact {
  min-height: 2.5rem;
  max-height: min(14rem, calc(var(--config-visible-rows) * 1.95rem + 2.5rem));
}

.config-panel__empty {
  padding: 0.65rem 0.8rem;
  color: var(--zn-text-muted);
  font-size: 0.76rem;
}

.config-row {
  --indent-size: calc(var(--config-depth) * 0.8rem);
  display: grid;
  grid-template-columns: minmax(8rem, 1.55fr) minmax(11rem, 1.45fr) auto minmax(5rem, 0.58fr);
  gap: 0.22rem;
  align-items: center;
  min-height: 1.7rem;
  padding: 0.1rem 0.35rem;
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
  align-items: center;
  gap: 0.28rem;
  min-width: 0;
  min-height: 1.35rem;
  padding-left: var(--indent-size);
}

.config-row__toggle,
.config-row__toggle-spacer {
  flex: 0 0 auto;
  align-self: center;
}

.config-row__toggle-spacer {
  width: 1.35rem;
  height: 1.35rem;
}

:deep(.config-row__toggle.zn-icon-button) {
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 0.22rem;
  box-shadow: none;
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1;
  padding: 0;
}

:deep(.config-row__toggle.zn-icon-button:focus-visible) {
  outline-offset: 0;
}

.config-row__name-copy {
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 1.35rem;
}

.config-row__label {
  display: block;
  color: var(--zn-heading);
  font-size: 0.83rem;
  font-weight: 700;
  line-height: 1.15;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-row__label--compact {
  text-overflow: clip;
}

.config-row__value {
  display: flex;
  align-items: center;
  min-width: 0;
}

.config-row__input,
.config-row__object-placeholder {
  width: 100%;
  min-height: 1.35rem;
  padding: 0.08rem 0.28rem;
  border: 1px solid var(--zn-border);
  border-radius: 0.45rem;
  background: color-mix(in srgb, var(--zn-bg-surface) 86%, white);
  color: var(--zn-text);
  font-size: 0.9em;
  font-family: inherit;
  font-weight: inherit;
  line-height: 1.1;
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
  align-items: center;
  align-self: center;
  gap: 0.02rem;
  padding-inline: 0.02rem;
}

.config-row__effective {
  display: grid;
  gap: 0.02rem;
  align-content: center;
  align-self: center;
  min-width: 0;
}

.config-row__effective-main {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  min-width: 0;
}

.config-row__effective-value {
  color: var(--zn-heading);
  font-family: var(--zn-font-mono);
  font-size: 0.65rem;
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-row__effective-marker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 0.82rem;
  height: 0.82rem;
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, var(--zn-warning) 48%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--zn-warning) 14%, white);
  color: color-mix(in srgb, var(--zn-heading) 82%, var(--zn-warning) 18%);
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1;
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

:global(.tippy-box[data-theme~='zn-config-help']) {
  border: 1px solid color-mix(in srgb, var(--zn-border-strong) 68%, transparent);
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--zn-bg-surface) 94%, white);
  color: var(--zn-text);
  box-shadow: 0 12px 32px color-mix(in srgb, black 18%, transparent);
}

:global(.tippy-box[data-theme~='zn-config-help'] > .tippy-arrow) {
  color: color-mix(in srgb, var(--zn-bg-surface) 94%, white);
}

:global(.config-help-tooltip) {
  display: grid;
  gap: 0.35rem;
  min-width: 14rem;
}

:global(.config-help-tooltip__path) {
  color: var(--zn-text-muted);
  font-family: var(--zn-font-mono);
  font-size: 0.76rem;
  line-height: 1.25;
}

:global(.config-help-tooltip__body) {
  color: var(--zn-text);
  font-size: 0.86rem;
  line-height: 1.5;
}

:global(.config-help-tooltip__body p) {
  margin: 0;
}

:global(.config-help-tooltip__body p + p) {
  margin-top: 0.45rem;
}

:global(.config-help-tooltip__body ul) {
  margin: 0.35rem 0 0 1rem;
  padding: 0;
}

:global(.config-help-tooltip__body li + li) {
  margin-top: 0.18rem;
}

:global(.config-help-tooltip__body blockquote) {
  margin: 0.45rem 0 0;
  padding: 0.35rem 0.55rem;
  border-left: 2px solid color-mix(in srgb, var(--zn-warning) 45%, transparent);
  background: color-mix(in srgb, var(--zn-warning) 10%, white);
  border-radius: 0.35rem;
}

:global(.config-help-tooltip__body code) {
  font-family: var(--zn-font-mono);
  font-size: 0.92em;
}

@media (max-width: 1100px) {
  .config-row {
    grid-template-columns: 1fr;
    gap: 0.2rem;
  }

  .config-row__actions {
    order: 4;
  }
}
</style>
