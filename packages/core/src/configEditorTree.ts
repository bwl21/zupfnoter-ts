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
  { pathSuffix: 'layout.PITCH_OFFSET', label: 'PitchOffset' },
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

export function buildConfigEditorSectionTree(formId: string): ConfigEditorTreeDefinition[] | undefined {
  const formSections = getConfigEditorFormSections(formId)
  if (formSections === undefined) return undefined

  return formSections.map((section) => ({
    key: `section:${section.id}`,
    label: section.label,
    children: buildSectionChildren(section.keys),
  }))
}

function buildSectionChildren(keys: readonly string[]): ConfigEditorTreeDefinition[] {
  const sectionPaths = keys
    .map((key) => configEditorKeyToTreePath(key))
    .filter((path) => path !== '.')

  if (sectionPaths.length === 0) return []

  const ancestor = longestCommonAncestor(sectionPaths)
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
  const fullDefinition = findConfigEditorTreeDefinition(CONFIG_EDITOR_TREE_DEFINITION, fullPath)
  if (fullDefinition !== undefined && fullPath === buildFullConfigPath(fullPath, relativePath)) {
    return fullDefinition.label
  }

  const candidatePath = fullPath.endsWith(relativePath) ? fullPath : buildFullConfigPath(fullPath, relativePath)
  const candidateDefinition = findConfigEditorTreeDefinition(CONFIG_EDITOR_TREE_DEFINITION, candidatePath)
  if (candidateDefinition !== undefined) return candidateDefinition.label

  return relativePath.split('.').at(-1) ?? relativePath
}

function buildFullConfigPath(fullPath: string, relativePath: string): string {
  const fullParts = fullPath.split('.')
  const relativeParts = relativePath.split('.')
  return fullParts.slice(0, fullParts.length - relativeParts.length).concat(relativeParts).join('.')
}

function joinPath(parentPath: string, key: string): string {
  return parentPath === '' ? key : `${parentPath}.${key}`
}
