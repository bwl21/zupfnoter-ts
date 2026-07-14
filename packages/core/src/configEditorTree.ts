import {
  LEGACY_BARNUMBERS_EXTRACT_PATH_SUFFIXES,
  LEGACY_COUNTNOTES_EXTRACT_PATH_SUFFIXES,
  LEGACY_LAYOUT_EXTRACT_PATH_SUFFIXES,
  LEGACY_LAYOUT_PACKER_EXTRACT_PATH_SUFFIXES,
  LEGACY_LYRICS_EXTRACT_PATH_SUFFIX_PATTERNS,
  LEGACY_NOTES_EXTRACT_PATH_SUFFIXES,
  LEGACY_PRINTER_EXTRACT_PATH_SUFFIXES,
  LEGACY_STRINGNAMES_EXTRACT_PATH_SUFFIXES,
} from './configSchema.js'
import { type CommandArgumentValue } from './commands.js'
import { getConfigEditorFormSections } from './configEditorForms.js'

export interface ConfigEditorTreeDefinition {
  key: string
  label: string
  children?: ConfigEditorTreeDefinition[]
  configPath?: string
}

interface PathLabelDefinition {
  pathSuffix: string
  label: string
}

const layoutTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'layout.instrument', label: 'Instrument' },
  { pathSuffix: 'layout.tuning', label: 'Stimmung' },
  { pathSuffix: 'layout.limit_a3', label: 'Begrenzung auf A3' },
  { pathSuffix: 'layout.bottomup', label: 'Spiel aufwaerts' },
  { pathSuffix: 'layout.beams', label: 'Notenhaelse' },
  { pathSuffix: 'layout.LINE_THIN', label: 'Linienstaerke duenn' },
  { pathSuffix: 'layout.LINE_MEDIUM', label: 'Linienstaerke mittel' },
  { pathSuffix: 'layout.LINE_THICK', label: 'Linienstaerke dick' },
  { pathSuffix: 'layout.ELLIPSE_SIZE', label: 'Notengroesse' },
  { pathSuffix: 'layout.REST_SIZE', label: 'Pausengroesse' },
  { pathSuffix: 'layout.X_SPACING', label: 'Saitenabstand' },
  { pathSuffix: 'layout.X_OFFSET', label: 'X - Offset' },
  { pathSuffix: 'layout.PITCH_OFFSET', label: 'Pitch-Offset' },
  { pathSuffix: 'layout.DRAWING_AREA_SIZE', label: 'Zeichenflaeche' },
]

const instrumentSpecificLayoutTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'layout.instrument', label: 'Instrument' },
  { pathSuffix: 'layout.tuning', label: 'Stimmung' },
  { pathSuffix: 'layout.limit_a3', label: 'Begrenzung auf A3' },
  { pathSuffix: 'layout.bottomup', label: 'Spiel aufwaerts' },
  { pathSuffix: 'layout.beams', label: 'Notenhaelse' },
  { pathSuffix: 'layout.X_OFFSET', label: 'X - Offset' },
  { pathSuffix: 'layout.X_SPACING', label: 'Saitenabstand' },
  { pathSuffix: 'layout.PITCH_OFFSET', label: 'Pitch-Offset' },
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

const noteEntryTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'notes.*.pos', label: 'Position' },
  { pathSuffix: 'notes.*.text', label: 'Text' },
  { pathSuffix: 'notes.*.style', label: 'Stil' },
  { pathSuffix: 'notes.*.align', label: 'Ausrichtung' },
]

const annotationEntryTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'annotations.*.pos', label: 'Position' },
  { pathSuffix: 'annotations.*.text', label: 'Text' },
  { pathSuffix: 'annotations.*.style', label: 'Stil' },
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

export const CONFIG_EDITOR_TREE_DEFINITION: ConfigEditorTreeDefinition[] = [
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
              ...mapTreeDefinitionsFromLabels(
                instrumentSpecificLayoutTreeLeafDefinitions,
                'layout.',
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
            children: mapTreeDefinitionsForWildcardPrefix(
              ['notes.*.pos', 'notes.*.text', 'notes.*.style', 'notes.*.align'],
              'notes.*.',
              noteEntryTreeLeafDefinitions,
            ),
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
  {
    key: 'annotations',
    label: 'Notenbeschriftungsvorlagen',
    children: mapTreeDefinitionsForWildcardPrefix(
      ['annotations.*.pos', 'annotations.*.text', 'annotations.*.style'],
      'annotations.*.',
      annotationEntryTreeLeafDefinitions,
    ),
  },
]

function mapTreeDefinitionsForPrefix(
  pathSuffixes: readonly string[],
  prefix: string,
  labels: readonly PathLabelDefinition[],
): ConfigEditorTreeDefinition[] {
  const labelMap = new Map(labels.map((entry) => [entry.pathSuffix, entry.label]))
  return pathSuffixes
    .filter((pathSuffix) => {
      if (!pathSuffix.startsWith(prefix)) return false
      if (prefix !== 'layout.packer.' && pathSuffix.includes('.packer.')) return false
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
): ConfigEditorTreeDefinition[] {
  const labelMap = new Map(labels.map((entry) => [entry.pathSuffix, entry.label]))
  return pathSuffixes
    .filter((pathSuffix) => pathSuffix.startsWith(prefix) && labelMap.has(pathSuffix))
    .map((pathSuffix) => ({
      key: pathSuffix.slice(prefix.length),
      label: labelMap.get(pathSuffix) ?? pathSuffix.slice(prefix.length),
    }))
}

function mapTreeDefinitionsFromLabels(
  labels: readonly PathLabelDefinition[],
  prefix: string,
): ConfigEditorTreeDefinition[] {
  return labels
    .filter((entry) => entry.pathSuffix.startsWith(prefix))
    .map((entry) => ({
      key: entry.pathSuffix.slice(prefix.length),
      label: entry.label,
    }))
}

export function configEditorKeyToTreePath(key: string): string {
  return key.replace(/^extract\.(\{extract\}|\d+)(?=\.|$)/, 'extract.current')
}

export function findConfigEditorTreeDefinition(
  definitions: ConfigEditorTreeDefinition[],
  path: string,
  parentPath = '',
): ConfigEditorTreeDefinition | undefined {
  for (const definition of definitions) {
    const currentPath = joinPath(parentPath, definition.key)
    if (currentPath === path) return definition
    const found = definition.children === undefined
      ? undefined
      : findConfigEditorTreeDefinition(definition.children, path, currentPath)
    if (found !== undefined) return found
  }
  return undefined
}

export function buildConfigEditorSectionTree(
  formId: string,
  currentConfig: Record<string, CommandArgumentValue>,
  effectiveConfig: Record<string, CommandArgumentValue>,
  extractId: number,
): ConfigEditorTreeDefinition[] | undefined {
  const formSections = getConfigEditorFormSections(formId)
  if (formSections === undefined) return undefined

  return formSections.map((section) => ({
    key: `section:${section.id}`,
    label: section.label,
    children: buildSectionChildren(formId, section.keys, currentConfig, effectiveConfig, extractId),
  }))
}

function buildSectionChildren(
  formId: string,
  keys: readonly string[],
  currentConfig: Record<string, CommandArgumentValue>,
  effectiveConfig: Record<string, CommandArgumentValue>,
  extractId: number,
): ConfigEditorTreeDefinition[] {
  const sectionPaths = keys
    .flatMap((key) => expandConfigEditorKeyToTreePaths(formId, key, currentConfig, effectiveConfig, extractId))
    .filter((path) => path !== '.')

  if (sectionPaths.length === 0) return []

  const ancestor = resolveSectionAncestor(formId, sectionPaths)
  const children: ConfigEditorTreeDefinition[] = []

  for (const path of sectionPaths) {
    const relativePath = ancestor === ''
      ? path
      : path === ancestor
        ? path.split('.').slice(-1)[0] ?? path
        : path.slice(ancestor.length + 1)

    insertSectionPath(children, relativePath, path)
  }

  return children
}

function resolveSectionAncestor(formId: string, sectionPaths: readonly string[]): string {
  if (formId === 'lyrics') {
    const collectionRoot = 'extract.current.lyrics'
    if (sectionPaths.some((path) => path.startsWith(`${collectionRoot}.`))) {
      return collectionRoot
    }
  }

  return longestCommonAncestor(sectionPaths)
}

function expandConfigEditorKeyToTreePaths(
  formId: string,
  key: string,
  currentConfig: Record<string, CommandArgumentValue>,
  effectiveConfig: Record<string, CommandArgumentValue>,
  extractId: number,
): string[] {
  switch (formId) {
    case 'extract_annotation':
      return expandExtractAnnotationPaths(key, currentConfig, effectiveConfig)
    case 'annotations': {
      const annotationPaths = expandAnnotationsCollectionPaths(key, currentConfig, effectiveConfig)
      if (annotationPaths !== undefined) return annotationPaths
      break
    }
    case 'lyrics':
      return expandLegacyExtractZeroWildcardPaths(key, currentConfig, extractId, 'lyrics')
    case 'images':
      return expandImagePaths(key, currentConfig, extractId)
    case 'notes': {
      const notesPaths = expandNotesCollectionPaths(key, currentConfig, extractId)
      if (notesPaths !== undefined) return notesPaths
      break
    }
    case 'stringnames': {
      const stringnamesPaths = expandStringnamesPaths(key, effectiveConfig, extractId)
      if (stringnamesPaths !== undefined) return stringnamesPaths
      break
    }
    default:
      break
  }

  const treePath = configEditorKeyToTreePath(key)
  if (!treePath.includes('.*.')) return [treePath]

  const [prefix, suffix] = treePath.split('.*.')
  if (prefix === undefined || suffix === undefined) return [treePath]

  const configPathPrefix = key
    .replace(/^extract\.(\{extract\}|\d+)(?=\.|$)/, `extract.${extractId}`)
    .split('.*.')[0]
  if (configPathPrefix === undefined) return [treePath]

  const wildcardParent = getPathValue(currentConfig, configPathPrefix)
  if (!isRecord(wildcardParent)) return []

  return Object.keys(wildcardParent)
    .sort(compareConfigKeys)
    .map((entryKey) => `${prefix}.${entryKey}.${suffix}`)
}

function expandExtractAnnotationPaths(
  key: string,
  currentConfig: Record<string, CommandArgumentValue>,
  effectiveConfig: Record<string, CommandArgumentValue>,
): string[] {
  if (!key.startsWith('extract.{extract}.')) return [configEditorKeyToTreePath(key)]

  const suffix = key.slice('extract.{extract}.'.length)
  const extractIds = collectExtractIds(currentConfig, effectiveConfig)
  if (extractIds.length === 0) return [configEditorKeyToTreePath(key)]

  return extractIds.map((extractKey) => `extract.${extractKey}.${suffix}`)
}

function expandLegacyExtractZeroWildcardPaths(
  key: string,
  currentConfig: Record<string, CommandArgumentValue>,
  extractId: number,
  collectionName: 'lyrics',
): string[] {
  const wildcardToken = `extract.{extract}.${collectionName}.*.`
  if (!key.startsWith(wildcardToken)) return [configEditorKeyToTreePath(key)]

  const suffix = key.slice(wildcardToken.length)
  const wildcardParent = getPathValue(currentConfig, `extract.0.${collectionName}`)
  if (!isRecord(wildcardParent)) return []

  return Object.keys(wildcardParent)
    .sort(compareConfigKeys)
    .map((entryKey) => `extract.current.${collectionName}.${entryKey}.${suffix}`)
}

function expandImagePaths(
  key: string,
  currentConfig: Record<string, CommandArgumentValue>,
  extractId: number,
): string[] {
  if (key === '$resources.*') {
    const resources = getPathValue(currentConfig, '$resources')
    if (!isRecord(resources)) return []
    return Object.keys(resources).sort(compareConfigKeys).map((entryKey) => `$resources.${entryKey}`)
  }

  const wildcardToken = 'extract.{extract}.images.*.'
  if (!key.startsWith(wildcardToken)) return [configEditorKeyToTreePath(key)]

  const suffix = key.slice(wildcardToken.length)
  const wildcardParent = getPathValue(currentConfig, 'extract.0.images')
  if (!isRecord(wildcardParent)) return []

  return Object.keys(wildcardParent)
    .sort(compareConfigKeys)
    .map((entryKey) => `extract.${extractId}.images.${entryKey}.${suffix}`)
}

function expandNotesCollectionPaths(
  key: string,
  config: Record<string, CommandArgumentValue>,
  extractId: number,
): string[] | undefined {
  if (key !== 'extract.{extract}.notes' && key !== `extract.${extractId}.notes`) return undefined

  const configPath = key.replace(/^extract\.(\{extract\}|\d+)(?=\.|$)/, `extract.${extractId}`)
  const notesValue = getPathValue(config, configPath)
  if (!isRecord(notesValue)) return [configEditorKeyToTreePath(key)]

  const entryPaths = Object.keys(notesValue)
    .sort(compareConfigKeys)
    .flatMap((entryKey) => {
      const noteValue = notesValue[entryKey]
      const properties = isRecord(noteValue)
        ? ['pos', 'text', 'style', 'align'].filter((property) => property in noteValue)
        : []

      if (properties.length === 0) return [`extract.current.notes.${entryKey}`]
      return properties.map((property) => `extract.current.notes.${entryKey}.${property}`)
    })

  return entryPaths.length === 0 ? [configEditorKeyToTreePath(key)] : entryPaths
}

function expandAnnotationsCollectionPaths(
  key: string,
  currentConfig: Record<string, CommandArgumentValue>,
  effectiveConfig: Record<string, CommandArgumentValue>,
): string[] | undefined {
  if (key !== 'annotations') return undefined

  const entryKeys = collectUnionObjectKeys(
    getPathValue(currentConfig, 'annotations'),
    getPathValue(effectiveConfig, 'annotations'),
  )
  if (entryKeys.length === 0) return ['annotations']

  return entryKeys.flatMap((entryKey) => {
    const currentValue = getPathValue(currentConfig, `annotations.${entryKey}`)
    const effectiveValue = getPathValue(effectiveConfig, `annotations.${entryKey}`)
    const propertyKeys = collectUnionPropertyKeys(currentValue, effectiveValue, ['pos', 'text', 'style'])

    if (propertyKeys.length === 0) return [`annotations.${entryKey}`]
    return propertyKeys.map((property) => `annotations.${entryKey}.${property}`)
  })
}

function expandStringnamesPaths(
  key: string,
  effectiveConfig: Record<string, CommandArgumentValue>,
  extractId: number,
): string[] | undefined {
  if (key !== 'extract.{extract}.stringnames' && key !== `extract.${extractId}.stringnames`) return undefined

  const subtree = getPathValue(effectiveConfig, 'extract.0.stringnames')
  if (!isRecord(subtree)) return [configEditorKeyToTreePath(key)]

  const suffixes = collectLeafSuffixes(subtree)
  if (suffixes.length === 0) return [configEditorKeyToTreePath(key)]

  return suffixes.map((suffix) => `extract.${extractId}.stringnames.${suffix}`)
}

function collectExtractIds(
  currentConfig: Record<string, CommandArgumentValue>,
  effectiveConfig: Record<string, CommandArgumentValue>,
): string[] {
  const currentExtracts = getPathValue(currentConfig, 'extract')
  const effectiveExtracts = getPathValue(effectiveConfig, 'extract')
  const extractIds = new Set<string>()

  if (isRecord(currentExtracts)) {
    for (const key of Object.keys(currentExtracts)) {
      extractIds.add(key)
    }
  }
  if (isRecord(effectiveExtracts)) {
    for (const key of Object.keys(effectiveExtracts)) {
      extractIds.add(key)
    }
  }

  return [...extractIds].sort(compareConfigKeys)
}

function collectLeafSuffixes(
  source: Record<string, CommandArgumentValue>,
  prefix = '',
): string[] {
  const result: string[] = []

  for (const key of Object.keys(source).sort(compareConfigKeys)) {
    const value = source[key]
    const nextPrefix = prefix === '' ? key : `${prefix}.${key}`
    if (isRecord(value)) {
      result.push(...collectLeafSuffixes(value, nextPrefix))
      continue
    }
    result.push(nextPrefix)
  }

  return result
}

function collectUnionObjectKeys(...sources: unknown[]): string[] {
  const keys = new Set<string>()

  for (const source of sources) {
    if (!isRecord(source)) continue
    for (const key of Object.keys(source)) {
      keys.add(key)
    }
  }

  return [...keys].sort(compareConfigKeys)
}

function collectUnionPropertyKeys(
  currentValue: unknown,
  effectiveValue: unknown,
  knownPropertyOrder: readonly string[],
): string[] {
  const keys = new Set<string>()

  for (const property of knownPropertyOrder) {
    if ((isRecord(currentValue) && property in currentValue) || (isRecord(effectiveValue) && property in effectiveValue)) {
      keys.add(property)
    }
  }

  return [...keys]
}

function getPathValue(source: unknown, path: string): unknown {
  const parts = path.split('.').filter((part) => part !== '')
  let current: unknown = source
  for (const part of parts) {
    if (!isRecord(current) || !(part in current)) return undefined
    current = current[part]
  }
  return current
}

function isRecord(value: unknown): value is Record<string, CommandArgumentValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function compareConfigKeys(left: string, right: string): number {
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  const leftIsNumber = Number.isInteger(leftNumber)
  const rightIsNumber = Number.isInteger(rightNumber)

  if (leftIsNumber && rightIsNumber) return leftNumber - rightNumber
  if (leftIsNumber) return -1
  if (rightIsNumber) return 1
  return left.localeCompare(right)
}

function longestCommonAncestor(paths: readonly string[]): string {
  if (paths.length === 0) return ''

  const firstParts = paths[0]?.split('.') ?? []
  let commonLength = firstParts.length

  for (const path of paths.slice(1)) {
    const parts = path.split('.')
    let index = 0
    while (index < commonLength && firstParts[index] === parts[index]) {
      index += 1
    }
    commonLength = index
  }

  return firstParts.slice(0, commonLength).join('.')
}

function insertSectionPath(
  definitions: ConfigEditorTreeDefinition[],
  relativePath: string,
  fullPath: string,
): void {
  const parts = relativePath.split('.')
  let currentDefinitions = definitions
  let currentPath = ''

  for (const [index, part] of parts.entries()) {
    currentPath = currentPath === '' ? part : `${currentPath}.${part}`
    let definition = currentDefinitions.find((entry) => entry.key === part)
    if (definition === undefined) {
      definition = {
        key: part,
        label: resolveTreeLabel(fullPath, currentPath),
        configPath: buildFullConfigPath(fullPath, currentPath),
      }
      currentDefinitions.push(definition)
    }

    if (index < parts.length - 1) {
      definition.children ??= []
      currentDefinitions = definition.children
      definition.configPath = undefined
    }
  }
}

function resolveTreeLabel(fullPath: string, relativePath: string): string {
  const normalizedFullPath = normalizeTreeDefinitionPath(fullPath)
  const fullDefinition = findConfigEditorTreeDefinition(CONFIG_EDITOR_TREE_DEFINITION, normalizedFullPath)
  if (fullDefinition !== undefined && normalizedFullPath === normalizeTreeDefinitionPath(buildFullConfigPath(fullPath, relativePath))) {
    return fullDefinition.label
  }

  const candidatePath = fullPath.endsWith(relativePath) ? fullPath : buildFullConfigPath(fullPath, relativePath)
  const candidateDefinition = findConfigEditorTreeDefinition(
    CONFIG_EDITOR_TREE_DEFINITION,
    normalizeTreeDefinitionPath(candidatePath),
  )
  if (candidateDefinition !== undefined) return candidateDefinition.label

  return relativePath.split('.').at(-1) ?? relativePath
}

function normalizeTreeDefinitionPath(path: string): string {
  return path
    .replace(/^extract\.\d+(?=\.|$)/, 'extract.current')
    .replace(/^(extract\.current\.(lyrics|notes|images))\.[^.]+(\..+)$/, '$1$3')
    .replace(/^(annotations)\.[^.]+(\..+)$/, '$1$2')
}

function buildFullConfigPath(fullPath: string, relativePath: string): string {
  const fullParts = fullPath.split('.')
  const relativeParts = relativePath.split('.')
  return fullParts.slice(0, fullParts.length - relativeParts.length).concat(relativeParts).join('.')
}

function joinPath(parentPath: string, key: string): string {
  return parentPath === '' ? key : `${parentPath}.${key}`
}
