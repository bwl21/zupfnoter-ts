import {
  LEGACY_BARNUMBERS_EXTRACT_PATH_SUFFIXES,
  LEGACY_COUNTNOTES_EXTRACT_PATH_SUFFIXES,
  LEGACY_LAYOUT_EXTRACT_PATH_SUFFIXES,
  LEGACY_LAYOUT_PACKER_EXTRACT_PATH_SUFFIXES,
  LEGACY_LYRICS_EXTRACT_PATH_SUFFIX_PATTERNS,
  LEGACY_NOTES_EXTRACT_PATH_SUFFIXES,
  LEGACY_PRINTER_EXTRACT_PATH_SUFFIXES,
  LEGACY_STRINGNAMES_EXTRACT_PATH_SUFFIXES,
  getConfigSchemaOverview,
  type JsonSchemaNode,
  resolveConfigSchemaPath,
} from './configSchema.js'
import { type CommandArgumentValue } from './commands.js'
import { getConfigEditorFormSections } from './configEditorForms.js'
import { abc2svgTextrans } from './localization/de-de.js'

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
  { pathSuffix: 'layout.instrument', label: legacyLabel('instrument') },
  { pathSuffix: 'layout.tuning', label: legacyLabel('tuning') },
  { pathSuffix: 'layout.limit_a3', label: legacyLabel('limit_a3') },
  { pathSuffix: 'layout.bottomup', label: legacyLabel('bottomup') },
  { pathSuffix: 'layout.beams', label: legacyLabel('beams') },
  { pathSuffix: 'layout.LINE_THIN', label: legacyLabel('LINE_THIN') },
  { pathSuffix: 'layout.LINE_MEDIUM', label: legacyLabel('LINE_MEDIUM') },
  { pathSuffix: 'layout.LINE_THICK', label: legacyLabel('LINE_THICK') },
  { pathSuffix: 'layout.ELLIPSE_SIZE', label: legacyLabel('ELLIPSE_SIZE') },
  { pathSuffix: 'layout.REST_SIZE', label: legacyLabel('REST_SIZE') },
  { pathSuffix: 'layout.X_SPACING', label: legacyLabel('X_SPACING') },
  { pathSuffix: 'layout.X_OFFSET', label: legacyLabel('X_OFFSET') },
  { pathSuffix: 'layout.PITCH_OFFSET', label: legacyLabel('PITCH_OFFSET') },
  { pathSuffix: 'layout.DRAWING_AREA_SIZE', label: legacyLabel('DRAWING_AREA_SIZE') },
]

const instrumentSpecificLayoutTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'layout.instrument', label: legacyLabel('instrument') },
  { pathSuffix: 'layout.tuning', label: legacyLabel('tuning') },
  { pathSuffix: 'layout.limit_a3', label: legacyLabel('limit_a3') },
  { pathSuffix: 'layout.bottomup', label: legacyLabel('bottomup') },
  { pathSuffix: 'layout.beams', label: legacyLabel('beams') },
  { pathSuffix: 'layout.X_OFFSET', label: legacyLabel('X_OFFSET') },
  { pathSuffix: 'layout.X_SPACING', label: legacyLabel('X_SPACING') },
  { pathSuffix: 'layout.PITCH_OFFSET', label: legacyLabel('PITCH_OFFSET') },
]

const printerTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'printer.show_border', label: legacyLabel('show_border') },
  { pathSuffix: 'printer.a3_offset', label: legacyLabel('a3_offset') },
  { pathSuffix: 'printer.a4_offset', label: legacyLabel('a4_offset') },
  { pathSuffix: 'printer.a4_pages', label: legacyLabel('a4_pages') },
]

const packerTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'layout.packer.pack_method', label: legacyLabel('pack_method') },
  { pathSuffix: 'layout.packer.pack_max_spreadfactor', label: legacyLabel('pack_max_spreadfactor') },
  { pathSuffix: 'layout.packer.pack_min_increment', label: legacyLabel('pack_min_increment') },
]

const barnumbersTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'barnumbers.voices', label: legacyLabel('voices') },
  { pathSuffix: 'barnumbers.pos', label: legacyLabel('pos') },
  { pathSuffix: 'barnumbers.style', label: legacyLabel('style') },
]

const countnotesTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'countnotes.voices', label: legacyLabel('voices') },
  { pathSuffix: 'countnotes.pos', label: legacyLabel('pos') },
  { pathSuffix: 'countnotes.style', label: legacyLabel('style') },
]

const notesTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'legend.pos', label: legacyLabel('pos') },
  { pathSuffix: 'legend.align', label: legacyLabel('align') },
  { pathSuffix: 'legend.spos', label: legacyLabel('spos') },
  { pathSuffix: 'notes', label: legacyLabel('notes') },
]

const noteEntryTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'notes.*.pos', label: legacyLabel('pos') },
  { pathSuffix: 'notes.*.text', label: legacyLabel('text') },
  { pathSuffix: 'notes.*.style', label: legacyLabel('style') },
  { pathSuffix: 'notes.*.align', label: legacyLabel('align') },
]

const annotationEntryTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'annotations.*.pos', label: legacyLabel('pos') },
  { pathSuffix: 'annotations.*.text', label: legacyLabel('text') },
  { pathSuffix: 'annotations.*.style', label: legacyLabel('style') },
]

const lyricsTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'lyrics.*.verses', label: legacyLabel('verses') },
  { pathSuffix: 'lyrics.*.pos', label: legacyLabel('pos') },
  { pathSuffix: 'lyrics.*.style', label: legacyLabel('style') },
]

const stringnamesTreeLeafDefinitions: PathLabelDefinition[] = [
  { pathSuffix: 'stringnames', label: legacyLabel('stringnames') },
  { pathSuffix: 'stringnames.text', label: legacyLabel('text') },
  { pathSuffix: 'stringnames.vpos', label: legacyLabel('vpos') },
  { pathSuffix: 'stringnames.marks.hpos', label: legacyLabel('hpos') },
  { pathSuffix: 'stringnames.marks.vpos', label: legacyLabel('vpos') },
]

function legacyLabel(key: string): string {
  const labelKey = key.split('.').pop() ?? key
  return abc2svgTextrans[labelKey as keyof typeof abc2svgTextrans] ?? key
}

function schemaPropertyTreeChildren(path: string): ConfigEditorTreeDefinition[] {
  const properties = resolveConfigSchemaPath(path)?.properties
  if (properties === undefined) return []
  return Object.keys(properties).map((key) => ({ key, label: legacyLabel(key) }))
}

/**
 * Darstellungsgeruest fuer den Konfigurationsbaum.
 *
 * Die aeussere Gliederung und Reihenfolge ist bewusst hier festgelegt. Die
 * enthaltenen Parameterlisten werden dagegen aus den Schema-Pfadmetadaten in
 * `configSchema.ts` abgeleitet. Dynamische `patternProperties` werden erst
 * beim Aufbau der Ansicht zu konkreten Eintraegen wie `lyrics.0` erweitert.
 * Diese Struktur daher nicht als zweite fachliche Konfigurationsquelle
 * behandeln oder parallel zum Schema pflegen.
 */
export const CONFIG_EDITOR_TREE_DEFINITION: ConfigEditorTreeDefinition[] = [
  { key: 'produce', label: legacyLabel('produce') },
  {
    key: 'restposition',
    label: legacyLabel('restposition'),
    children: schemaPropertyTreeChildren('restposition'),
  },
  {
    key: 'extract',
    label: legacyLabel('extract'),
    children: [
      {
        key: 'current',
        label: '0',
        children: [
          { key: 'title', label: legacyLabel('title') },
          { key: 'voices', label: legacyLabel('voices') },
          { key: 'flowlines', label: legacyLabel('flowlines') },
          { key: 'subflowlines', label: legacyLabel('subflowlines') },
          { key: 'synchlines', label: legacyLabel('synchlines') },
          { key: 'layoutlines', label: legacyLabel('layoutlines') },
          { key: 'startpos', label: legacyLabel('startpos') },
          {
            key: 'layout',
            label: legacyLabel('layout'),
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
                label: legacyLabel('packer'),
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
            label: legacyLabel('printer'),
            children: mapTreeDefinitionsForPrefix(
              LEGACY_PRINTER_EXTRACT_PATH_SUFFIXES,
              'printer.',
              printerTreeLeafDefinitions,
            ),
          },
          {
            key: 'barnumbers',
            label: legacyLabel('barnumbers'),
            children: mapTreeDefinitionsForPrefix(
              LEGACY_BARNUMBERS_EXTRACT_PATH_SUFFIXES,
              'barnumbers.',
              barnumbersTreeLeafDefinitions,
            ),
          },
          {
            key: 'countnotes',
            label: legacyLabel('countnotes'),
            children: mapTreeDefinitionsForPrefix(
              LEGACY_COUNTNOTES_EXTRACT_PATH_SUFFIXES,
              'countnotes.',
              countnotesTreeLeafDefinitions,
            ),
          },
          {
            key: 'legend',
            label: legacyLabel('legend'),
            children: mapTreeDefinitionsForPrefix(
              LEGACY_NOTES_EXTRACT_PATH_SUFFIXES,
              'legend.',
              notesTreeLeafDefinitions,
            ),
          },
          {
            key: 'notes',
            label: legacyLabel('notes'),
            children: mapTreeDefinitionsForWildcardPrefix(
              ['notes.*.pos', 'notes.*.text', 'notes.*.style', 'notes.*.align'],
              'notes.*.',
              noteEntryTreeLeafDefinitions,
            ),
          },
          {
            key: 'lyrics',
            label: legacyLabel('lyrics'),
            children: mapTreeDefinitionsForWildcardPrefix(
              LEGACY_LYRICS_EXTRACT_PATH_SUFFIX_PATTERNS,
              'lyrics.*.',
              lyricsTreeLeafDefinitions,
            ),
          },
          {
            key: 'stringnames',
            label: legacyLabel('stringnames'),
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
    label: legacyLabel('annotations'),
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

/**
 * Baut den vollstaendigen Konfigurationsbaum fuer die Legacy-Ansicht
 * „Alle Parameter“.
 *
 * Dynamische Objektknoten aus dem Schema, etwa `lyrics.*`, werden anhand der
 * vorhandenen Konfigurationseintraege in konkrete Knoten aufgeloest.
 */
export function buildConfigEditorAllParametersTree(
  currentConfig: Record<string, CommandArgumentValue>,
  effectiveConfig: Record<string, CommandArgumentValue>,
  extractId: number,
): ConfigEditorTreeDefinition[] {
  return buildSchemaTreeChildren(
    getConfigSchemaOverview(),
    '',
    '',
    currentConfig,
    effectiveConfig,
    extractId,
  )
}

/** Baut den generischen Legacy-Formularbaum für einen konkreten Konfigurationspfad. */
export function buildConfigEditorTargetTree(
  path: string,
  currentConfig: Record<string, CommandArgumentValue>,
  effectiveConfig: Record<string, CommandArgumentValue>,
  extractId: number,
): ConfigEditorTreeDefinition[] {
  const parts = path.split('.').filter((part) => part.length > 0)
  const lastPart = parts[parts.length - 1]
  if (lastPart === undefined) return []

  let child = buildSchemaTreeNode(
    lastPart,
    path,
    path,
    currentConfig,
    effectiveConfig,
    extractId,
  )
  for (let index = parts.length - 2; index >= 0; index -= 1) {
    const prefix = parts.slice(0, index + 1).join('.')
    child = {
      key: parts[index] ?? prefix,
      label: legacyLabel(parts[index] ?? prefix),
      configPath: prefix,
      children: [child],
    }
  }
  return [child]
}

const ALL_PARAMETERS_INTERNAL_ROOTS = new Set([
  'confstack',
  'defaults',
  'templates',
  'presets',
  'neatjson',
])

function buildSchemaTreeChildren(
  schema: JsonSchemaNode,
  parentTreePath: string,
  parentSchemaPath: string,
  currentConfig: Record<string, CommandArgumentValue>,
  effectiveConfig: Record<string, CommandArgumentValue>,
  extractId: number,
): ConfigEditorTreeDefinition[] {
  const properties = Object.keys(schema.properties ?? {})
  const definitions: ConfigEditorTreeDefinition[] = []

  for (const key of properties) {
    if (parentTreePath === '' && ALL_PARAMETERS_INTERNAL_ROOTS.has(key)) continue

    if (parentTreePath === '' && key === 'extract') {
      const treePath = 'extract.current'
      const schemaPath = `extract.${extractId}`
      definitions.push({
        key,
        label: legacyLabel(key),
        children: [buildSchemaTreeNode(
          'current',
          treePath,
          schemaPath,
          currentConfig,
          effectiveConfig,
          extractId,
          String(extractId),
        )],
      })
      continue
    }

    const treePath = joinPath(parentTreePath, key)
    const schemaPath = joinPath(parentSchemaPath, key)
    definitions.push(buildSchemaTreeNode(
      key,
      treePath,
      schemaPath,
      currentConfig,
      effectiveConfig,
      extractId,
    ))
  }

  for (const key of collectSchemaDynamicKeys(schema, parentSchemaPath, currentConfig, effectiveConfig)) {
    const treePath = joinPath(parentTreePath, key)
    const schemaPath = joinPath(parentSchemaPath, key)
    definitions.push(buildSchemaTreeNode(
      key,
      treePath,
      schemaPath,
      currentConfig,
      effectiveConfig,
      extractId,
      key,
    ))
  }

  return definitions
}

function buildSchemaTreeNode(
  key: string,
  treePath: string,
  schemaPath: string,
  currentConfig: Record<string, CommandArgumentValue>,
  effectiveConfig: Record<string, CommandArgumentValue>,
  extractId: number,
  label = legacyLabel(key),
): ConfigEditorTreeDefinition {
  const schema = resolveConfigSchemaPath(schemaPath)
  const children = schema === undefined
    ? []
    : buildSchemaTreeChildren(schema, treePath, schemaPath, currentConfig, effectiveConfig, extractId)

  const isSchemaObject = schema?.properties !== undefined || schema?.patternProperties !== undefined
  return children.length === 0 && !isSchemaObject
    ? { key, label, configPath: treePath }
    : { key, label, children, configPath: treePath }
}

function collectSchemaDynamicKeys(
  schema: JsonSchemaNode,
  schemaPath: string,
  currentConfig: Record<string, CommandArgumentValue>,
  effectiveConfig: Record<string, CommandArgumentValue>,
): string[] {
  if (schema.patternProperties === undefined) return []
  const patterns = Object.keys(schema.patternProperties).map((pattern) => {
    const normalizedPattern = pattern.replace(/d([+*])/g, '\\d$1')
    return new RegExp(normalizedPattern)
  })
  return collectUnionObjectKeys(getPathValue(currentConfig, schemaPath), getPathValue(effectiveConfig, schemaPath))
    .filter((key) => patterns.some((pattern) => pattern.test(key)))
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
    markEmptySchemaObjectBranch(children, relativePath, path, extractId)
  }

  return children
}

function markEmptySchemaObjectBranch(
  definitions: ConfigEditorTreeDefinition[],
  relativePath: string,
  fullPath: string,
  extractId: number,
): void {
  const definition = findRelativeTreeDefinition(definitions, relativePath)
  if (definition?.children !== undefined) return
  const schemaPath = fullPath
    .replace(/^extract\.current(?=\.|$)/, `extract.${extractId}`)
  const schema = resolveConfigSchemaPath(schemaPath)
  if (schema?.properties !== undefined || schema?.patternProperties !== undefined) {
    if (definition !== undefined) definition.children = []
  }
}

function findRelativeTreeDefinition(
  definitions: ConfigEditorTreeDefinition[],
  relativePath: string,
): ConfigEditorTreeDefinition | undefined {
  let current = definitions
  let definition: ConfigEditorTreeDefinition | undefined
  for (const part of relativePath.split('.')) {
    definition = current.find((entry) => entry.key === part)
    if (definition === undefined) return undefined
    current = definition.children ?? []
  }
  return definition
}

function resolveSectionAncestor(formId: string, sectionPaths: readonly string[]): string {
  if (formId === 'lyrics') {
    const collectionRoots = ['extract.current.lyrics', 'extract.0.lyrics']
    const collectionRoot = collectionRoots.find((root) => sectionPaths.some((path) => path.startsWith(`${root}.`)))
    if (collectionRoot !== undefined) {
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
      return expandLegacyExtractZeroWildcardPaths(key, currentConfig, effectiveConfig, 'lyrics')
    case 'images':
      return expandImagePaths(key, currentConfig, effectiveConfig)
    case 'notes': {
      const notesPaths = expandNotesCollectionPaths(key, currentConfig, effectiveConfig, extractId)
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
  const schemaPath = key.replace(/^extract\.(\{extract\}|\d+)(?=\.|$)/, `extract.${extractId}`)
  const schema = resolveConfigSchemaPath(schemaPath)
  if (schema?.properties !== undefined || schema?.patternProperties !== undefined) {
    return expandSchemaObjectPaths(schemaPath, treePath, currentConfig, effectiveConfig)
  }
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

function expandSchemaObjectPaths(
  schemaPath: string,
  treePath: string,
  currentConfig: Record<string, CommandArgumentValue>,
  effectiveConfig: Record<string, CommandArgumentValue>,
): string[] {
  const schema = resolveConfigSchemaPath(schemaPath)
  if (schema === undefined) return [treePath]

  const propertyNames = new Set(Object.keys(schema.properties ?? {}))
  const currentValue = getPathValue(currentConfig, schemaPath)
  const effectiveValue = getPathValue(effectiveConfig, schemaPath)
  for (const value of [currentValue, effectiveValue]) {
    if (!isRecord(value)) continue
    for (const key of Object.keys(value)) propertyNames.add(key)
  }

  if (propertyNames.size === 0) return [treePath]

  const paths: string[] = []
  for (const propertyName of [...propertyNames].sort(compareConfigKeys)) {
    const childSchemaPath = `${schemaPath}.${propertyName}`
    const childTreePath = `${treePath}.${propertyName}`
    const childSchema = resolveConfigSchemaPath(childSchemaPath)
    if (childSchema?.properties !== undefined || childSchema?.patternProperties !== undefined) {
      paths.push(...expandSchemaObjectPaths(childSchemaPath, childTreePath, currentConfig, effectiveConfig))
    } else {
      paths.push(childTreePath)
    }
  }
  return paths
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
  effectiveConfig: Record<string, CommandArgumentValue>,
  collectionName: 'lyrics',
): string[] {
  const wildcardToken = `extract.{extract}.${collectionName}.*.`
  if (!key.startsWith(wildcardToken)) return [configEditorKeyToTreePath(key)]

  const suffix = key.slice(wildcardToken.length)
  const entryKeys = collectConfigKeysAtPaths(currentConfig, effectiveConfig, [`extract.0.${collectionName}`])
  if (entryKeys.length === 0) return []

  return entryKeys
    .sort(compareConfigKeys)
    // Lyrics are, like images, configured once in extract 0 and shared by
    // the extract views. Keep the editor bound to the source path so values
    // remain visible when another extract is active.
    .map((entryKey) => `extract.0.${collectionName}.${entryKey}.${suffix}`)
}

function expandImagePaths(
  key: string,
  currentConfig: Record<string, CommandArgumentValue>,
  effectiveConfig: Record<string, CommandArgumentValue>,
): string[] {
  if (key === '$resources.*') {
    return collectConfigKeysAtPaths(currentConfig, effectiveConfig, ['$resources'])
      .map((entryKey) => `$resources.${entryKey}`)
  }

  const wildcardToken = 'extract.{extract}.images.*.'
  if (!key.startsWith(wildcardToken)) return [configEditorKeyToTreePath(key)]

  const suffix = key.slice(wildcardToken.length)
  const entryKeys = collectConfigKeysAtPaths(currentConfig, effectiveConfig, ['extract.0.images'])
  if (entryKeys.length === 0) return []

  return entryKeys
    .sort(compareConfigKeys)
    // Image entries are created in extract 0 and are shared by the
    // workbench's extract views. Keep the editor bound to that source path;
    // otherwise the fields appear empty as soon as another extract is active.
    .map((entryKey) => `extract.0.images.${entryKey}.${suffix}`)
}

function expandNotesCollectionPaths(
  key: string,
  currentConfig: Record<string, CommandArgumentValue>,
  effectiveConfig: Record<string, CommandArgumentValue>,
  extractId: number,
): string[] | undefined {
  if (key !== 'extract.{extract}.notes' && key !== `extract.${extractId}.notes`) return undefined

  const configPath = key.replace(/^extract\.(\{extract\}|\d+)(?=\.|$)/, `extract.${extractId}`)
  const currentNotesValue = getPathValue(currentConfig, configPath)
  const effectiveNotesValue = getPathValue(effectiveConfig, configPath)
  const noteKeys = collectConfigKeysAtPaths(currentConfig, effectiveConfig, [configPath])
  if (noteKeys.length === 0) return [configEditorKeyToTreePath(key)]

  const entryPaths = noteKeys
    .sort(compareConfigKeys)
    .flatMap((entryKey) => {
      const values = [
        isRecord(currentNotesValue) ? currentNotesValue[entryKey] : undefined,
        isRecord(effectiveNotesValue) ? effectiveNotesValue[entryKey] : undefined,
      ]
      const properties = ['pos', 'text', 'style', 'align'].filter((property) => values.some((value) => isRecord(value) && property in value))

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

function collectConfigKeysAtPaths(
  currentConfig: Record<string, CommandArgumentValue>,
  effectiveConfig: Record<string, CommandArgumentValue>,
  paths: readonly string[],
): string[] {
  return collectUnionObjectKeys(
    ...paths.flatMap((path) => [
      getPathValue(currentConfig, path),
      getPathValue(effectiveConfig, path),
    ]),
  )
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
      // Keep the concrete path on dynamic branches (for example
      // `notes.0`). The section wrapper itself is synthetic, but the
      // generated entry branch must remain deletable as a subtree.
      if (currentPath.startsWith('section:')) definition.configPath = undefined
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

  return legacyLabel(relativePath.split('.').at(-1) ?? relativePath)
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
  const startIndex = fullParts.findIndex((_, index) => relativeParts.every(
    (part, offset) => fullParts[index + offset] === part,
  ))
  if (startIndex >= 0) {
    return fullParts.slice(0, startIndex + relativeParts.length).join('.')
  }
  return fullParts.slice(0, fullParts.length - relativeParts.length).concat(relativeParts).join('.')
}

function joinPath(parentPath: string, key: string): string {
  return parentPath === '' ? key : `${parentPath}.${key}`
}
