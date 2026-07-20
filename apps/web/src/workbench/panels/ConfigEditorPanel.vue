<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import 'tippy.js/dist/tippy.css'

import {
  buildConfigEditorAllParametersTree,
  buildConfigEditorSectionTree,
  configEditorKeyToTreePath,
  CONFIG_EDITOR_TREE_DEFINITION,
  CONFIG_EDITOR_MENU_ITEMS,
  Confstack,
  extractSongConfig,
  findConfigEditorTreeDefinition,
  formatConfigEditorValue,
  getConfigEditorNewEntryCommand,
  getConfigEditorQuickSettingLabel,
  getConfigPathActionProfile,
  getConfigEditorFormSet,
  initConf,
  mergeSongConfig,
  parseConfigEditorValue,
  resolveConfigSchemaPath,
  type CommandArgumentValue,
  type ConfigEditorOption,
  type ConfigEditorStrategy,
  type ConfigEditorMenuCommand,
  type ConfigEditorTreeDefinition,
} from '@zupfnoter/core'

import { ZnBadge, ZnButton, ZnIconButton, ZnIcon, ZnPanel, ZnToolbar } from '@zupfnoter/design-system'
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
    | 'config.deletePath'
    | 'config.setPath'
    | 'config.copyPathToExtract'
    | 'config.movePathToExtract'
    | 'config.openMenuAtPath'
  path?: string
  value?: CommandArgumentValue
  extractId: number
  targetExtract?: number
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
  canFill: boolean
  canDelete: boolean
  canSelect: boolean
  menuKind: string
  editorOptions?: readonly ConfigEditorOption[]
  editorStrategy?: ConfigEditorStrategy
  valueType?: string
}

interface ConfigExtractOption {
  extractNumber: number
  label: string
}

interface QuickSettingMenuItem {
  type: 'command' | 'separator'
  id: string
  label?: string
}

const props = withDefaults(defineProps<{
  abcText: string
  currentExtract: number
  activeSection: string
  canUndo?: boolean
  canRedo?: boolean
  extractOptions?: readonly ConfigExtractOption[]
  entryMutationVersion?: number
}>(), {
  extractOptions: () => [],
  canUndo: false,
  canRedo: false,
  entryMutationVersion: 0,
})

const emit = defineEmits<{
  intent: [intent: ConfigIntent]
}>()

const searchText = ref('')
const panelElement = ref<HTMLElement | null>(null)
const configMenuElement = ref<HTMLDetailsElement | null>(null)
const quickSettingsMenuElement = ref<HTMLDetailsElement | null>(null)
const panelWidth = ref(1400)
const expandedPaths = ref<string[]>([
  'extract',
  'extract.current',
  'extract.current.layout',
  'extract.current.layout.packer',
  'extract.current.printer',
])
const draftValues = ref<Record<string, string>>({})
const inputErrors = ref<Record<string, string>>({})

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
const newEntryCommand = computed(() => getConfigEditorNewEntryCommand(props.activeSection, props.currentExtract))
const canAddEntry = computed(() => newEntryCommand.value !== undefined)
const quickSettings = computed<QuickSettingMenuItem[]>(() => {
  const formSet = getConfigEditorFormSet(props.activeSection)
  const presets = defaultConfig.value.presets as unknown as Record<string, unknown>
  return (formSet?.quicksettingCommands ?? []).flatMap((command) => {
    if (command === 'stdextract') {
      return [{ type: 'command' as const, id: command, label: getConfigEditorQuickSettingLabel(command) }]
    }
    const prefix = 'preset.'
    if (!command.startsWith(prefix)) return []
    const domain = command.slice(prefix.length)
    const family = presets[domain]
    if (typeof family !== 'object' || family === null || Array.isArray(family)) return []
    return Object.keys(family).map((name): QuickSettingMenuItem => {
      const id = `${command}.${name}`
      if (/^-+$/.test(name)) return { type: 'separator', id }
      return { type: 'command', id, label: getConfigEditorQuickSettingLabel(id) }
    })
  })
})
const hasQuickSettings = computed(() => quickSettings.value.some((item) => item.type === 'command'))

const visibleRows = computed(() => buildVisibleRows())
const usesCompactShell = computed(() => visibleRows.value.length <= 4)
let panelResizeObserver: ResizeObserver | undefined
const helpTooltips = new Map<HTMLElement, TippyInstance>()
const optionTooltips = new Map<HTMLElement, TippyInstance>()
const toolbarTooltips = new Map<HTMLElement, TippyInstance>()
const configHelpTexts = ref<ConfigHelpTexts>({})
const activeSectionTreeDefinition = computed(() => buildActiveSectionTreeDefinition())
const pendingNewEntryBranchPaths = ref<ReadonlySet<string> | undefined>(undefined)

watch(
  [() => props.currentExtract, () => props.abcText],
  () => {
    draftValues.value = {}
    inputErrors.value = {}
  },
)

watch(
  visibleRows,
  () => {
    void nextTick(() => {
      syncHelpTooltips()
      syncOptionTooltips()
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

watch(
  hasQuickSettings,
  () => {
    void nextTick(() => syncToolbarTooltips())
  },
)

watch(
  () => props.entryMutationVersion,
  () => {
    const previousBranchPaths = pendingNewEntryBranchPaths.value
    if (previousBranchPaths === undefined) return

    void nextTick(() => {
      const definitions = activeSectionTreeDefinition.value
      const newBranchPaths = definitions === undefined
        ? []
        : collectBranchPaths(definitions).filter((path) => !previousBranchPaths.has(path))

      if (newBranchPaths.length > 0) {
        const nextExpanded = new Set(expandedPaths.value)
        newBranchPaths.forEach((path) => nextExpanded.add(path))
        expandedPaths.value = [...nextExpanded]
      }

      pendingNewEntryBranchPaths.value = undefined
    })
  },
)

onMounted(() => {
  document.addEventListener('pointerdown', closeEditorOptionsOnOutsidePointerDown)
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
    syncOptionTooltips()
  })
  void nextTick(() => {
    syncHelpTooltips()
    syncOptionTooltips()
    syncToolbarTooltips()
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeEditorOptionsOnOutsidePointerDown)
  panelResizeObserver?.disconnect()
  destroyHelpTooltips()
  destroyOptionTooltips()
  destroyToolbarTooltips()
})

function buildVisibleRows(): ConfigTreeRow[] {
  if (activeSectionTreeDefinition.value !== undefined) {
    return flattenTree(activeSectionTreeDefinition.value, '', 0, false)
  }
  return flattenTree(CONFIG_EDITOR_TREE_DEFINITION)
}

function flattenTree(
  definitions: ConfigEditorTreeDefinition[],
  parentPath = '',
  depth = 0,
  respectActiveSectionFilter = true,
): ConfigTreeRow[] {
  const rows: ConfigTreeRow[] = []

  for (const definition of definitions) {
    const path = joinPath(parentPath, definition.key)
    if (respectActiveSectionFilter && !isVisibleInActiveSection(path)) {
      continue
    }
    const branch = definition.children !== undefined && definition.children.length > 0
    const row = createRow(definition, path, depth, branch)
    const matches = matchesRow(row)
    const children = branch
      ? flattenTree(definition.children ?? [], path, depth + 1, respectActiveSectionFilter)
      : []
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
  if (section === 'all_parameters' && activeSectionTreeDefinition.value !== undefined) {
    const nextExpanded = new Set(expandedPaths.value)
    for (const branchPath of collectBranchPaths(activeSectionTreeDefinition.value)) {
      nextExpanded.add(branchPath)
    }
    expandedPaths.value = [...nextExpanded]
    return
  }

  if (section === props.activeSection && activeSectionTreeDefinition.value !== undefined) {
    const nextExpanded = new Set(expandedPaths.value)
    for (const branchPath of collectBranchPaths(activeSectionTreeDefinition.value)) {
      nextExpanded.add(branchPath)
    }
    expandedPaths.value = [...nextExpanded]
    return
  }

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

function collectBranchPaths(
  definitions: ConfigEditorTreeDefinition[],
  parentPath = '',
): string[] {
  const branchPaths: string[] = []

  for (const definition of definitions) {
    const path = joinPath(parentPath, definition.key)
    if (definition.children !== undefined && definition.children.length > 0) {
      branchPaths.push(path, ...collectBranchPaths(definition.children, path))
    }
  }

  return branchPaths
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
  return findConfigEditorTreeDefinition(CONFIG_EDITOR_TREE_DEFINITION, path) !== undefined
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
  definition: ConfigEditorTreeDefinition,
  path: string,
  depth: number,
  isBranch: boolean,
): ConfigTreeRow {
  const configPath = definition.configPath ?? path
  const localPath = definition.configPath === undefined && path.startsWith('section:')
    ? undefined
    : resolveLocalPath(configPath)
  const effectivePath = localPath === undefined ? undefined : resolveEffectivePath(configPath)
  const localValue = localPath === undefined ? undefined : getPathValue(parsedSongConfig.value.config, localPath)
  const effectiveValue = effectivePath === undefined ? undefined : getPathValue(effectiveConfig.value, effectivePath)
  const actionProfile = getConfigPathActionProfile(localPath, {
    hasEffectiveValue: effectiveValue !== undefined,
    hasLocalValue: localValue !== undefined,
    isLeaf: !isBranch,
  })
  const schema = localPath === undefined ? undefined : resolveConfigSchemaPath(localPath)

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
    canFill: actionProfile.canFill,
    canDelete: actionProfile.canDelete,
    canSelect: actionProfile.canSelect,
    menuKind: actionProfile.menuKind,
    editorOptions: schema?.['x-zupfnoter-editor']?.options,
    editorStrategy: schema?.['x-zupfnoter-editor']?.strategy,
    valueType: typeof schema?.type === 'string' ? schema.type : undefined,
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

function buildActiveSectionTreeDefinition(): ConfigEditorTreeDefinition[] | undefined {
  if (props.activeSection === 'all_parameters') {
    return buildConfigEditorAllParametersTree(
      parsedSongConfig.value.config as unknown as Record<string, CommandArgumentValue>,
      effectiveConfig.value as unknown as Record<string, CommandArgumentValue>,
      props.currentExtract,
    )
  }
  return buildConfigEditorSectionTree(
    props.activeSection,
    parsedSongConfig.value.config as unknown as Record<string, CommandArgumentValue>,
    effectiveConfig.value as unknown as Record<string, CommandArgumentValue>,
    props.currentExtract,
  )
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

function getDraftValue(row: ConfigTreeRow): string {
  const draftValue = draftValues.value[row.path]
  if (draftValue !== undefined) return draftValue
  if (row.localValue === undefined) return ''
  const localFormatPath = row.localPath ?? row.path
  if (Array.isArray(row.localValue)) return formatConfigEditorValue(localFormatPath, row.localValue)
  return formatConfigEditorValue(localFormatPath, row.localValue)
}

function getDraftPlaceholder(row: ConfigTreeRow): string {
  if (row.canFill && row.effectiveValue !== undefined) {
    return formatConfigEditorValue(row.effectivePath ?? row.path, row.effectiveValue)
  }
  return 'Kein lokaler Wert'
}

function getDeleteButtonLabel(row: ConfigTreeRow): string {
  return row.canDelete
    ? 'Pfad oder Teilbaum loeschen. Danach wird der wirksame Wert neu ermittelt.'
    : 'Pfad oder Teilbaum loeschen'
}

function updateDraftValue(row: ConfigTreeRow, value: string): void {
  draftValues.value = {
    ...draftValues.value,
    [row.path]: value,
  }
  if (inputErrors.value[row.path] !== undefined) {
    const { [row.path]: _error, ...remainingErrors } = inputErrors.value
    inputErrors.value = remainingErrors
  }
}

function commitDraftValue(row: ConfigTreeRow): void {
  const value = draftValues.value[row.path]
  if (value === undefined || value === formatConfigEditorValue(row.localPath ?? row.path, row.localValue)) return
  const parsed = row.localPath === undefined ? { error: 'Der Konfigurationspfad fehlt.' } : parseConfigEditorValue(row.localPath, value)
  if (parsed.error !== undefined) {
    inputErrors.value = {
      ...inputErrors.value,
      [row.path]: parsed.error,
    }
    return
  }
  emit('intent', {
    action: 'config.setPath',
    path: row.localPath,
    value: parsed.value,
    extractId: props.currentExtract,
  })
}

function hasEditorOptions(row: ConfigTreeRow): boolean {
  return getEditorOptions(row).length > 0
}

function getEditorOptions(row: ConfigTreeRow): readonly ConfigEditorOption[] {
  if (row.editorOptions !== undefined) {
    if (!(row.localPath?.endsWith('.imagename') ?? false)) return row.editorOptions
    const resources = getPathValue(effectiveConfig.value, '$resources')
    if (!isRecord(resources)) return row.editorOptions
    const resourceOptions = Object.keys(resources).sort().map((value) => ({
      value,
      label: value,
      description: 'Vorhandene Bildressource',
    } satisfies ConfigEditorOption))
    return [...row.editorOptions, ...resourceOptions.filter((option) => !row.editorOptions?.some((entry) => entry.value === option.value))]
  }
  if (row.editorStrategy !== 'font-style-select') return []

  const styles = getPathValue(effectiveConfig.value, 'layout.FONT_STYLE_DEF')
  if (!isRecord(styles)) return []
  return Object.entries(styles).map(([value, style]) => ({
    value,
    label: isRecord(style) && typeof style.label === 'string' ? style.label : value,
    description: isRecord(style) && typeof style.description === 'string' ? style.description : '',
  }))
}

function isBooleanValue(row: ConfigTreeRow): boolean {
  return row.valueType === 'boolean'
}

function isTextareaValue(row: ConfigTreeRow): boolean {
  return row.editorStrategy === 'textarea'
}

function getBooleanValue(row: ConfigTreeRow): boolean {
  if (typeof row.localValue === 'boolean') return row.localValue
  return typeof row.effectiveValue === 'boolean' ? row.effectiveValue : false
}

function commitBooleanValue(row: ConfigTreeRow, value: boolean): void {
  if (row.localPath === undefined) return
  emit('intent', {
    action: 'config.setPath',
    path: row.localPath,
    value,
    extractId: props.currentExtract,
  })
}

function getSelectDraftValue(row: ConfigTreeRow): string {
  const draftValue = draftValues.value[row.path]
  if (draftValue !== undefined) return draftValue
  if (typeof row.localValue === 'string' || typeof row.localValue === 'number' || typeof row.localValue === 'boolean') {
    return String(row.localValue)
  }
  if (typeof row.effectiveValue === 'string' || typeof row.effectiveValue === 'number' || typeof row.effectiveValue === 'boolean') {
    return String(row.effectiveValue)
  }
  return ''
}

function getSelectedOptionLabel(row: ConfigTreeRow): string {
  const value = getSelectDraftValue(row)
  const option = getEditorOptions(row).find((entry) => entry.value === value)
  return option === undefined ? 'Bitte auswählen' : `${option.label} (${option.value})`
}

function selectEditorOption(row: ConfigTreeRow, value: string, event: MouseEvent): void {
  updateDraftValue(row, value)
  commitDraftValue(row)
  const details = (event.currentTarget as HTMLElement).closest('details')
  if (details !== null) details.open = false
}

function closeEditorOptions(event: KeyboardEvent): void {
  const details = event.currentTarget as HTMLDetailsElement
  details.open = false
  details.querySelector<HTMLElement>('summary')?.focus()
}

function closeEditorOptionsOnOutsidePointerDown(event: PointerEvent): void {
  const target = event.target
  if (!(target instanceof Node) || panelElement.value === null) return

  for (const details of panelElement.value.querySelectorAll<HTMLDetailsElement>('details.config-row__select[open]')) {
    if (!details.contains(target)) details.open = false
  }
  for (const details of panelElement.value.querySelectorAll<HTMLDetailsElement>('details.config-row__menu[open]')) {
    if (!details.contains(target)) details.open = false
  }
}

interface ConfigRowMenuEntry {
  label: string
  path: string
  targetExtract: number
  action: 'copy' | 'move'
}

function getConfigExtractOptions(): ConfigExtractOption[] {
  const options = new Map<number, ConfigExtractOption>([[0, { extractNumber: 0, label: '0' }]])
  for (const option of props.extractOptions) options.set(option.extractNumber, option)
  if (!options.has(props.currentExtract)) {
    options.set(props.currentExtract, { extractNumber: props.currentExtract, label: String(props.currentExtract) })
  }
  return [...options.values()].sort((left, right) => left.extractNumber - right.extractNumber)
}

function getRowSourceEntries(row: ConfigTreeRow): ConfigRowMenuEntry[] {
  const localPath = row.localPath
  if (localPath === undefined || !localPath.startsWith('extract.')) return []

  const match = localPath.match(/^extract\.(\d+)(\..+)$/)
  if (match === null) return []
  const sourceExtract = Number(match[1])
  const suffix = match[2]
  return getConfigExtractOptions()
    .filter((option) => option.extractNumber !== sourceExtract)
    .map((option) => ({
      label: option.label,
      path: `extract.${option.extractNumber}${suffix}`,
      targetExtract: sourceExtract,
      action: 'copy' as const,
    }))
}

function getRowMoveEntry(row: ConfigTreeRow): ConfigRowMenuEntry | undefined {
  const localPath = row.localPath
  if (localPath === undefined || !/^extract\.\d+\./.test(localPath)) return undefined
  const sourceExtract = Number(localPath.match(/^extract\.(\d+)\./)?.[1])
  if (!Number.isFinite(sourceExtract) || sourceExtract === 0) return undefined
  return {
    label: 'Nach Auszug 0 verschieben',
    path: localPath,
    targetExtract: 0,
    action: 'move',
  }
}

function hasRowMenu(row: ConfigTreeRow): boolean {
  return row.canFill || getRowSourceEntries(row).length > 0 || getRowMoveEntry(row) !== undefined
}

function closeRowMenu(event: KeyboardEvent): void {
  const details = (event.currentTarget as HTMLElement).closest('details.config-row__menu') as HTMLDetailsElement | null
  if (details === null) return
  details.open = false
  details.querySelector<HTMLElement>('summary')?.focus()
}

function closeRowMenuAndFill(row: ConfigTreeRow, event: MouseEvent): void {
  const details = (event.currentTarget as HTMLElement).closest('details.config-row__menu') as HTMLDetailsElement | null
  if (details !== null) details.open = false
  fillFromEffectiveValue(row)
}

function emitRowMenuIntent(entry: ConfigRowMenuEntry, event: MouseEvent): void {
  const details = (event.currentTarget as HTMLElement).closest('details.config-row__menu') as HTMLDetailsElement | null
  if (details !== null) details.open = false
  emit('intent', {
    action: entry.action === 'move' ? 'config.movePathToExtract' : 'config.copyPathToExtract',
    path: entry.path,
    extractId: props.currentExtract,
    targetExtract: entry.targetExtract,
  })
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
      trigger: 'click',
      hideOnClick: true,
      theme: 'zn-config-help',
      maxWidth: 560,
      placement: 'top-start',
      offset: [0, 6],
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

function syncOptionTooltips(): void {
  if (panelElement.value === null) return
  const elements = panelElement.value.querySelectorAll<HTMLElement>('.config-row__select-option[data-option-description]')

  for (const element of elements) {
    const description = element.dataset.optionDescription
    if (description === undefined || description === '') continue
    const existing = optionTooltips.get(element)
    if (existing !== undefined) {
      existing.setContent(createMarkdownTooltipContent(description))
      continue
    }
    optionTooltips.set(element, tippy(element, {
      content: createMarkdownTooltipContent(description),
      placement: 'right',
      maxWidth: 280,
      theme: 'zn-config-help',
    }))
  }

  for (const [element, instance] of optionTooltips) {
    if (panelElement.value.contains(element)) continue
    instance.destroy()
    optionTooltips.delete(element)
  }
}

function destroyOptionTooltips(): void {
  for (const instance of optionTooltips.values()) {
    instance.destroy()
  }
  optionTooltips.clear()
}

function syncToolbarTooltips(): void {
  if (panelElement.value === null) return
  const elements = panelElement.value.querySelectorAll<HTMLElement>('[data-toolbar-tooltip]')

  for (const element of elements) {
    const content = element.dataset.toolbarTooltip
    if (content === undefined || content === '') continue
    const existing = toolbarTooltips.get(element)
    if (existing !== undefined) {
      existing.setContent(content)
      continue
    }
    toolbarTooltips.set(element, tippy(element, {
      content,
      placement: 'top',
      theme: 'zn-config-help',
    }))
  }

  for (const [element, instance] of toolbarTooltips) {
    if (panelElement.value.contains(element)) continue
    instance.destroy()
    toolbarTooltips.delete(element)
  }
}

function destroyToolbarTooltips(): void {
  for (const instance of toolbarTooltips.values()) {
    instance.destroy()
  }
  toolbarTooltips.clear()
}

/** Erzeugt sichere Tooltip-Inhalte aus dem unterstützten Inline-Markdown. */
function createMarkdownTooltipContent(markdown: string): HTMLElement {
  const container = document.createElement('div')
  const lines = markdown.split('\n')

  for (const [index, line] of lines.entries()) {
    if (index > 0) container.append(document.createElement('br'))
    appendInlineMarkdown(container, line)
  }

  return container
}

function appendInlineMarkdown(container: HTMLElement, markdown: string): void {
  const tokenPattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let cursor = 0

  for (const match of markdown.matchAll(tokenPattern)) {
    const start = match.index ?? 0
    if (start > cursor) container.append(document.createTextNode(markdown.slice(cursor, start)))

    const token = match[0]
    const element = token.startsWith('**')
      ? document.createElement('strong')
      : token.startsWith('*')
        ? document.createElement('em')
        : document.createElement('code')
    element.textContent = token.startsWith('**') ? token.slice(2, -2) : token.slice(1, -1)
    container.append(element)
    cursor = start + token.length
  }

  if (cursor < markdown.length) container.append(document.createTextNode(markdown.slice(cursor)))
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

function fillFromEffectiveValue(row: ConfigTreeRow): void {
  if (row.localPath === undefined || !isCommandArgumentValue(row.effectiveValue)) return
  if (row.isBranch && !isExpanded(row.path)) {
    expandedPaths.value = [...expandedPaths.value, row.path]
  }
  emit('intent', {
    action: 'config.setPath',
    path: row.localPath,
    value: row.effectiveValue,
    extractId: props.currentExtract,
  })
}

function isCommandArgumentValue(value: unknown): value is CommandArgumentValue {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true
  }
  if (Array.isArray(value)) return value.every(isCommandArgumentValue)
  if (!isRecord(value)) return false
  return Object.values(value).every(isCommandArgumentValue)
}

function handleAddEntry(): void {
  if (newEntryCommand.value === undefined) return
  const definitions = activeSectionTreeDefinition.value
  pendingNewEntryBranchPaths.value = new Set(definitions === undefined ? [] : collectBranchPaths(definitions))
  emitIntent('config.addEntry', newEntryCommand.value)
}

function selectConfigMenuItem(item: ConfigEditorMenuCommand): void {
  if (configMenuElement.value !== null) {
    configMenuElement.value.open = false
  }
  emitIntent('config.editSection', item.id)
}

function selectQuickSetting(item: QuickSettingMenuItem): void {
  if (item.type !== 'command') return
  if (quickSettingsMenuElement.value !== null) {
    quickSettingsMenuElement.value.open = false
  }
  emit('intent', {
    action: 'config.quicksettings',
    path: item.id,
    extractId: props.currentExtract,
  })
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
            :disabled="!props.canUndo"
            data-toolbar-tooltip="Letzte Konfigurationsänderung zurücknehmen"
            @click="emitIntent('config.undo')"
          >
            <ZnIcon name="undo" />
          </ZnIconButton>
          <ZnIconButton
            class="config-panel__toolbar-icon"
            label="Redo"
            variant="ghost"
            :disabled="!props.canRedo"
            data-toolbar-tooltip="Zurückgenommene Konfigurationsänderung wiederherstellen"
            @click="emitIntent('config.redo')"
          >
            <ZnIcon name="redo" />
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
          <details
            v-if="hasQuickSettings"
            ref="quickSettingsMenuElement"
            class="config-panel__main-menu config-panel__quicksettings"
          >
            <summary class="config-panel__main-menu-summary" data-toolbar-tooltip="Schnelleinstellung anwenden">
              <ZnIcon name="quickSettings" />
              <span>Schnelleinst.</span>
            </summary>
            <div class="config-panel__main-menu-list" role="menu" aria-label="Schnelleinstellungen">
              <template v-for="setting in quickSettings" :key="setting.id">
                <div v-if="setting.type === 'separator'" class="config-panel__main-menu-separator" role="separator" />
                <button
                v-else
                class="config-panel__main-menu-item"
                type="button"
                role="menuitem"
                @click="selectQuickSetting(setting)"
              >
                  {{ setting.label }}
              </button>
              </template>
            </div>
          </details>
          <span v-else class="config-panel__toolbar-disabled-control" data-toolbar-tooltip="Für diesen Bereich gibt es keine Schnelleinstellungen">
            <ZnButton variant="ghost" disabled>
              <ZnIcon name="quickSettings" />
              <span>Schnelleinst.</span>
            </ZnButton>
          </span>
          <ZnButton
            variant="ghost"
            :disabled="!canAddEntry"
            data-toolbar-tooltip="Neuen Eintrag im aktuellen Bereich anlegen"
            @click="handleAddEntry"
          >
            <ZnIcon name="newEntry" />
            <span>Neuer Eintrag</span>
          </ZnButton>
          <details ref="configMenuElement" class="config-panel__main-menu">
            <summary
            class="config-panel__main-menu-summary"
            aria-haspopup="menu"
            data-toolbar-tooltip="Konfigurationsbereich auswählen"
          >
              <ZnIcon class="config-panel__main-menu-icon" name="edit" />
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
            'config-row--multiline': isTextareaValue(row),
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
              <ZnIcon :name="isExpanded(row.path) ? 'collapse' : 'expand'" />
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
            <span
              class="config-row__help"
              role="button"
              tabindex="0"
              aria-label="Hilfe anzeigen"
              :data-help-key="row.localPath ?? row.path"
            >
              <ZnIcon name="help" />
            </span>
            <details
              v-if="row.isLeaf && hasEditorOptions(row)"
              class="config-row__input config-row__select"
              @keydown.esc.prevent="closeEditorOptions($event)"
            >
              <summary class="config-row__select-summary">
                <span>{{ getSelectedOptionLabel(row) }}</span>
                <ZnIcon class="config-row__select-caret" name="collapse" aria-hidden="true" />
              </summary>
              <div class="config-row__select-options" role="listbox" :aria-label="`${row.label} auswählen`">
                <button
                  v-for="option in getEditorOptions(row)"
                  :key="option.value"
                  class="config-row__select-option"
                  :class="{ 'config-row__select-option--selected': option.value === getSelectDraftValue(row) }"
                  type="button"
                  role="option"
                  :aria-selected="option.value === getSelectDraftValue(row)"
                  :data-option-description="option.description"
                  @click="selectEditorOption(row, option.value, $event)"
                >
                  {{ option.label }} ({{ option.value }})
                </button>
              </div>
            </details>
            <div v-else-if="row.isLeaf && isBooleanValue(row)" class="config-row__boolean">
              <button
                type="button"
                class="config-row__switch"
                :class="{ 'config-row__switch--on': getBooleanValue(row) }"
                role="switch"
                :aria-checked="getBooleanValue(row)"
                :aria-label="`${row.label} aktivieren`"
                @click="commitBooleanValue(row, !getBooleanValue(row))"
              >
                <span class="config-row__switch-thumb" aria-hidden="true" />
              </button>
              <span>{{ getBooleanValue(row) ? 'Ja' : 'Nein' }}</span>
            </div>
            <textarea
              v-else-if="row.isLeaf && isTextareaValue(row)"
              :value="getDraftValue(row)"
              class="config-row__input config-row__textarea"
              rows="2"
              :placeholder="getDraftPlaceholder(row)"
              :aria-invalid="inputErrors[row.path] !== undefined"
              :aria-describedby="inputErrors[row.path] !== undefined ? `config-error-${row.key}` : undefined"
              @input="updateDraftValue(row, ($event.target as HTMLTextAreaElement).value)"
              @blur="commitDraftValue(row)"
            />
            <input
              v-else-if="row.isLeaf"
              :value="getDraftValue(row)"
              class="config-row__input"
              type="text"
              :placeholder="getDraftPlaceholder(row)"
              :aria-invalid="inputErrors[row.path] !== undefined"
              :aria-describedby="inputErrors[row.path] !== undefined ? `config-error-${row.key}` : undefined"
              @input="updateDraftValue(row, ($event.target as HTMLInputElement).value)"
              @blur="commitDraftValue(row)"
              @keydown.enter.prevent="commitDraftValue(row)"
            >
            <span
              v-if="row.isLeaf && inputErrors[row.path] !== undefined"
              :id="`config-error-${row.key}`"
              class="config-row__input-error"
              role="alert"
            >
              {{ inputErrors[row.path] }}
            </span>
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
              <ZnIcon name="select" />
            </ZnIconButton>
            <details
              v-if="hasRowMenu(row)"
              class="config-row__menu"
              @keydown.esc.prevent="closeRowMenu($event)"
            >
              <summary class="config-row__menu-summary" aria-haspopup="menu" :title="row.localPath ?? row.path">
                <ZnIcon name="menu" />
              </summary>
              <div class="config-row__menu-list" role="menu" :aria-label="`${row.label} verschieben oder holen`">
                <button
                  v-if="row.canFill"
                  type="button"
                  class="config-row__menu-item"
                  role="menuitem"
                  @click="closeRowMenuAndFill(row, $event)"
                >
                  Wirksamen Wert eintragen
                </button>
                <div v-if="getRowSourceEntries(row).length > 0" class="config-row__submenu-group">
                  <div class="config-row__menu-heading">Aus Auszug holen …</div>
                  <button
                    v-for="entry in getRowSourceEntries(row)"
                    :key="`${entry.path}:${entry.targetExtract}`"
                    type="button"
                    class="config-row__menu-item config-row__submenu-item"
                    role="menuitem"
                    @click="emitRowMenuIntent(entry, $event)"
                  >
                    {{ entry.label }}
                  </button>
                </div>
                <button
                  v-if="getRowMoveEntry(row) !== undefined"
                  type="button"
                  class="config-row__menu-item"
                  role="menuitem"
                  @click="emitRowMenuIntent(getRowMoveEntry(row) as ConfigRowMenuEntry, $event)"
                >
                  Nach Auszug 0 verschieben
                </button>
              </div>
            </details>
            <ZnIconButton
              v-else
              class="config-row__action"
              label="Parametermenue nicht verfügbar"
              variant="ghost"
              :title="row.localPath ?? row.path"
              :disabled="true"
              :tabindex="-1"
            >
              <ZnIcon name="menu" />
            </ZnIconButton>
            <ZnIconButton
              class="config-row__action"
              :label="getDeleteButtonLabel(row)"
              variant="ghost"
              :disabled="!row.canDelete"
              :tabindex="-1"
            @click="emitIntent('config.deletePath', row.localPath)"
            >
              <ZnIcon name="delete" />
            </ZnIconButton>
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
  width: 0.96rem;
  height: 0.96rem;
  border-radius: 999px;
  box-shadow: none;
  font-size: 0.72rem;
}

:deep(.config-panel__toolbar-icon.zn-icon-button:not(:disabled)) {
  color: var(--zn-heading);
  font-size: 0.82rem;
  font-weight: 700;
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
  grid-template-columns: minmax(8rem, max-content) minmax(11rem, 1fr) auto;
  grid-auto-rows: max-content;
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
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
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

.config-row--multiline {
  align-items: start;
  min-height: calc(2.7em + 0.55rem);
}

.config-row--multiline .config-row__name,
.config-row--multiline .config-row__actions {
  align-self: start;
  padding-top: 0.25rem;
}

.config-row--multiline .config-row__value {
  align-items: start;
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
  gap: 0.28rem;
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

.config-row__input::placeholder {
  color: var(--zn-text-muted);
  opacity: 0.62;
}

.config-row__textarea {
  min-height: calc(2.7em + 0.35rem);
  resize: vertical;
  line-height: 1.35;
}

.config-row__select {
  font-family: inherit;
  position: relative;
}

.config-row__select-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  cursor: pointer;
  list-style: none;
}

.config-row__select-summary::-webkit-details-marker {
  display: none;
}

.config-row__select-caret {
  flex: 0 0 auto;
  font-size: 0.7rem;
  transition: transform 120ms ease;
}

.config-row__select[open] .config-row__select-caret {
  transform: rotate(180deg);
}

.config-row__select-options {
  position: absolute;
  z-index: 5;
  top: calc(100% + 0.2rem);
  left: 0;
  min-width: 100%;
  padding: 0.2rem;
  border: 1px solid var(--zn-border);
  border-radius: 0.45rem;
  background: var(--zn-bg-surface);
  box-shadow: var(--zn-shadow-soft);
}

.config-row__select-option {
  display: block;
  width: 100%;
  padding: 0.22rem 0.35rem;
  border: 0;
  border-radius: 0.28rem;
  background: transparent;
  color: var(--zn-text);
  font: inherit;
  font-size: 0.82rem;
  text-align: left;
  cursor: pointer;
}

.config-row__select-option:hover,
.config-row__select-option--selected {
  background: var(--zn-bg-surface-soft);
}

.config-row__boolean {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 1.35rem;
  color: var(--zn-text);
  font-size: 0.82rem;
  cursor: pointer;
}

.config-row__switch {
  position: relative;
  width: 2.25rem;
  height: 1.25rem;
  padding: 0.12rem;
  border: 1px solid var(--zn-border-strong);
  border-radius: 999px;
  background: var(--zn-border-strong);
  cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease;
}

.config-row__switch--on {
  border-color: #3f9c5f;
  background: #4caf70;
}

.config-row__switch-thumb {
  display: block;
  width: 0.85rem;
  height: 0.85rem;
  border-radius: 50%;
  background: var(--zn-bg-elevated);
  box-shadow: var(--zn-shadow-soft);
  transform: translateX(0);
  transition: transform 140ms ease;
}

.config-row__switch--on .config-row__switch-thumb {
  transform: translateX(0.96rem);
}

.config-row__input:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--zn-accent) 60%, white);
  outline-offset: 2px;
}

.config-row__input-error {
  color: var(--zn-text-muted);
  font-size: 0.72rem;
  line-height: 1.2;
}

.config-row__input-error {
  color: var(--zn-danger, #9f1c1c);
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

.config-row__menu {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.config-row__menu-summary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.45rem;
  height: 1.45rem;
  border-radius: 999px;
  color: var(--zn-text-soft);
  cursor: pointer;
  list-style: none;
}

.config-row__menu-summary::-webkit-details-marker {
  display: none;
}

.config-row__menu-summary:hover,
.config-row__menu-summary:focus-visible {
  background: var(--zn-bg-surface-soft);
  outline: none;
}

.config-row__menu-list {
  position: absolute;
  z-index: 6;
  top: calc(100% + 0.2rem);
  right: 0;
  display: grid;
  min-width: max-content;
  padding: 0.2rem;
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-md);
  background: var(--zn-bg-elevated);
  box-shadow: var(--zn-shadow-soft);
}

.config-row__menu-item {
  padding: 0.3rem 0.55rem;
  border: 0;
  border-radius: var(--zn-radius-sm);
  background: transparent;
  color: var(--zn-text);
  font: inherit;
  font-size: 0.78rem;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}

.config-row__menu-heading {
  padding: 0.3rem 0.55rem 0.15rem;
  color: var(--zn-text-muted);
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
}

.config-row__submenu-item {
  display: block;
  width: 100%;
  padding-left: 0.9rem;
}

.config-row__menu-item:hover,
.config-row__menu-item:focus-visible {
  background: var(--zn-bg-surface-soft);
  outline: none;
}

:deep(.config-row__action.zn-icon-button) {
  width: 1.45rem;
  height: 1.45rem;
  border-radius: 999px;
  box-shadow: none;
  font-size: 0.76rem;
}

.config-row__help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.45rem;
  height: 1.45rem;
  flex: 0 0 auto;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--zn-text-soft);
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
}

.config-row__help:hover,
.config-row__help:focus-visible {
  color: var(--zn-accent);
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
