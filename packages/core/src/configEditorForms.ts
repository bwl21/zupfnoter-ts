/**
 * Legacy-nahe Konfiguration der Perspektiven im Konfigurationseditor.
 *
 * Portiert aus `ConfstackEditor.get_config_form_menu_entries` in
 * `config-form.rb` und aus den `form_sets` des Legacy-Kommandos `editconf`
 * in `controller_command_definitions.rb`.
 *
 * Wichtig:
 * Das Legacy-System definiert fuer `editconf` nur Menueeintraege und eine
 * geordnete Keyliste pro Formset. Abschnitts- oder Gruppierungsdaten gibt es
 * dort nicht als eigene produktive Struktur. Falls das TS-UI Abschnitte
 * braucht, muessen sie hier als Darstellungsmetadaten an derselben fachlichen
 * Keyquelle haengen und duerfen nicht als direkte Legacy-Struktur ausgegeben
 * werden.
 */

import {
  LEGACY_BARNUMBERS_EXTRACT_PATH_SUFFIXES,
  LEGACY_COUNTNOTES_EXTRACT_PATH_SUFFIXES,
  LEGACY_LAYOUT_EXTRACT_PATH_SUFFIXES,
  LEGACY_LAYOUT_PACKER_EXTRACT_PATH_SUFFIXES,
  LEGACY_LYRICS_EXTRACT_PATH_SUFFIX_PATTERNS,
  LEGACY_NOTES_EXTRACT_PATH_SUFFIXES,
  LEGACY_PRINTER_EXTRACT_PATH_SUFFIXES,
  LEGACY_STRINGNAMES_EXTRACT_PATH_SUFFIXES,
  toExtractConfigPath,
} from './configSchema.js'
import { abc2svgTextrans } from './localization/de-de.js'

export type ConfigEditorFormId =
  | 'extract_annotation'
  | 'notes'
  | 'basic_settings'
  | 'lyrics'
  | 'layout'
  | 'instrument_specific'
  | 'barnumbers_countnotes'
  | 'repeatsigns'
  | 'annotations'
  | 'stringnames'
  | 'printer'
  | 'notebound'
  | 'images'
  | 'validationerrors'
  | 'all_parameters'
  | 'template'

export interface ConfigEditorMenuSeparator {
  type: 'separator'
}

export interface ConfigEditorMenuCommand {
  type: 'command'
  id: ConfigEditorFormId
  legacyText: string
  legacyIcon: string
  label: string
  title: string
}

export type ConfigEditorMenuItem = ConfigEditorMenuSeparator | ConfigEditorMenuCommand

export interface ConfigEditorFormSet {
  id: ConfigEditorFormId
  keys: string[]
  scope: 'extract' | 'global' | 'mixed'
  quicksettingCommands?: string[]
  supportsNewEntry: boolean
  newEntryCommand?: string
  newEntryExtractZeroOnly?: boolean
  sections?: ConfigEditorFormSection[]
}

export interface ConfigEditorFormSection {
  id: string
  label: string
  keys: string[]
}

function createFormSection(
  id: string,
  label: string,
  keys: readonly string[],
): ConfigEditorFormSection {
  return {
    id,
    label,
    keys: [...keys],
  }
}

const LAYOUT_FORM_KEYS = [
  'extract.{extract}.layoutlines',
  'extract.{extract}.startpos',
  ...LEGACY_LAYOUT_EXTRACT_PATH_SUFFIXES
    .filter((suffix) => !LEGACY_LAYOUT_PACKER_EXTRACT_PATH_SUFFIXES.includes(
      suffix as (typeof LEGACY_LAYOUT_PACKER_EXTRACT_PATH_SUFFIXES)[number],
    ))
    .map((suffix) => toExtractConfigPath(suffix)),
  ...LEGACY_LAYOUT_PACKER_EXTRACT_PATH_SUFFIXES.map((suffix) => toExtractConfigPath(suffix)),
] as const

const PRINTER_FORM_KEYS = [
  'extract.{extract}.printer',
  'extract.{extract}.layout.limit_a3',
] as const

const INSTRUMENT_SPECIFIC_FORM_KEYS = [
  'extract.{extract}.layout.instrument',
  'extract.{extract}.layout.tuning',
  'extract.{extract}.layout.limit_a3',
  'extract.{extract}.layout.bottomup',
  'extract.{extract}.layout.beams',
  'extract.{extract}.layout.X_OFFSET',
  'extract.{extract}.layout.X_SPACING',
  'extract.{extract}.layout.PITCH_OFFSET',
  'extract.{extract}.stringnames.text',
  ...LEGACY_PRINTER_EXTRACT_PATH_SUFFIXES.map((suffix) => toExtractConfigPath(suffix)),
  'extract.{extract}.stringnames.marks.hpos',
  'extract.{extract}.stringnames.marks.vpos',
] as const

const INSTRUMENT_SPECIFIC_FORM_SECTIONS: ConfigEditorFormSection[] = [
  {
    id: 'layout',
    label: 'Layout',
    keys: [
      'extract.{extract}.layout.instrument',
      'extract.{extract}.layout.tuning',
      'extract.{extract}.layout.limit_a3',
      'extract.{extract}.layout.bottomup',
      'extract.{extract}.layout.beams',
      'extract.{extract}.layout.X_OFFSET',
      'extract.{extract}.layout.X_SPACING',
      'extract.{extract}.layout.PITCH_OFFSET',
    ],
  },
  {
    id: 'stringnames_text',
    label: 'Saitennamen',
    keys: [
      'extract.{extract}.stringnames.text',
    ],
  },
  {
    id: 'printer',
    label: 'Drucker',
    keys: [...LEGACY_PRINTER_EXTRACT_PATH_SUFFIXES.map((suffix) => toExtractConfigPath(suffix))],
  },
  {
    id: 'stringnames_marks',
    label: 'Saitenmarken',
    keys: [
      'extract.{extract}.stringnames.marks.hpos',
      'extract.{extract}.stringnames.marks.vpos',
    ],
  },
]

const BARNUMBERS_COUNTNOTES_FORM_KEYS = [
  ...LEGACY_BARNUMBERS_EXTRACT_PATH_SUFFIXES.map((suffix) => toExtractConfigPath(suffix)),
  ...LEGACY_COUNTNOTES_EXTRACT_PATH_SUFFIXES.map((suffix) => toExtractConfigPath(suffix)),
  'extract.{extract}.chords.voices',
  'extract.{extract}.chords.pos',
  'extract.{extract}.chords.style',
  'extract.{extract}.tuplets.text',
  'extract.{extract}.tuplets.style',
] as const

const NOTES_FORM_KEYS = LEGACY_NOTES_EXTRACT_PATH_SUFFIXES.map((suffix) => toExtractConfigPath(suffix)) as readonly string[]

const LYRICS_FORM_KEYS = LEGACY_LYRICS_EXTRACT_PATH_SUFFIX_PATTERNS.map((suffix) => toExtractConfigPath(suffix)) as readonly string[]

const STRINGNAMES_FORM_KEYS = [
  toExtractConfigPath(LEGACY_STRINGNAMES_EXTRACT_PATH_SUFFIXES[0]),
  'extract.{extract}.sortmark',
] as const

const CONFIG_EDITOR_FORM_SECTIONS: Record<ConfigEditorFormId, ConfigEditorFormSection[]> = {
  basic_settings: [
    createFormSection('basic_settings', 'Grundeinstellungen', [
      'produce',
      'extract.{extract}.title',
      'extract.{extract}.filenamepart',
      'extract.{extract}.voices',
      'extract.{extract}.flowlines',
      'extract.{extract}.subflowlines',
      'extract.{extract}.synchlines',
      'extract.{extract}.jumplines',
      'extract.{extract}.layoutlines',
      'extract.{extract}.nonflowrest',
      'extract.{extract}.startpos',
      'extract.{extract}.repeatsigns.voices',
      'extract.{extract}.barnumbers.voices',
      'extract.{extract}.countnotes.voices',
      'extract.{extract}.stringnames.vpos',
      'extract.{extract}.sortmark.show',
      'restposition',
    ]),
  ],
  extract_annotation: [
    createFormSection('extract_annotation', 'Auszugsbeschriftung', [
      'produce',
      'extract.{extract}.title',
      'extract.{extract}.voices',
      'extract.{extract}.filenamepart',
    ]),
  ],
  barnumbers_countnotes: [
    createFormSection('barnumbers', 'Taktnummern', LEGACY_BARNUMBERS_EXTRACT_PATH_SUFFIXES.map((suffix) => toExtractConfigPath(suffix))),
    createFormSection('countnotes', 'Zaehlmarken', LEGACY_COUNTNOTES_EXTRACT_PATH_SUFFIXES.map((suffix) => toExtractConfigPath(suffix))),
    createFormSection('chords', 'Akkorde', [
      'extract.{extract}.chords.voices',
      'extract.{extract}.chords.pos',
      'extract.{extract}.chords.style',
    ]),
    createFormSection('tuplets', 'Tuplets', [
      'extract.{extract}.tuplets.text',
      'extract.{extract}.tuplets.style',
    ]),
  ],
  annotations: [
    createFormSection('annotations', 'Notenbeschriftungsvorlagen', ['annotations']),
  ],
  notes: [
    createFormSection('notes', 'Seitenbeschriftung', NOTES_FORM_KEYS),
  ],
  lyrics: [
    createFormSection('lyrics', 'Liedtexte', LYRICS_FORM_KEYS),
  ],
  images: [
    createFormSection('images', 'Bilder', [
      '$resources.*',
      'extract.{extract}.images.*.imagename',
      'extract.{extract}.images.*.show',
      'extract.{extract}.images.*.pos',
      'extract.{extract}.images.*.height',
    ]),
  ],
  notebound: [
    createFormSection('notebound', 'Notenbezogen', ['extract.{extract}.notebound']),
  ],
  layout: [
    createFormSection('extract', 'Auszug', [
      'extract.{extract}.layoutlines',
      'extract.{extract}.startpos',
    ]),
    createFormSection(
      'layout',
      'Layout',
      LEGACY_LAYOUT_EXTRACT_PATH_SUFFIXES
        .filter((suffix) => !LEGACY_LAYOUT_PACKER_EXTRACT_PATH_SUFFIXES.includes(
          suffix as (typeof LEGACY_LAYOUT_PACKER_EXTRACT_PATH_SUFFIXES)[number],
        ))
        .map((suffix) => toExtractConfigPath(suffix)),
    ),
    createFormSection(
      'packer',
      'Packer',
      LEGACY_LAYOUT_PACKER_EXTRACT_PATH_SUFFIXES.map((suffix) => toExtractConfigPath(suffix)),
    ),
  ],
  printer: [
    createFormSection('printer', 'Druckeranpassungen', [
      'extract.{extract}.printer',
      'extract.{extract}.layout.limit_a3',
    ]),
  ],
  repeatsigns: [
    createFormSection('repeatsigns', 'Wiederholungszeichen', [
      'extract.{extract}.repeatsigns.voices',
      'extract.{extract}.repeatsigns.left.pos',
      'extract.{extract}.repeatsigns.left.text',
      'extract.{extract}.repeatsigns.left.style',
      'extract.{extract}.repeatsigns.right.pos',
      'extract.{extract}.repeatsigns.right.text',
      'extract.{extract}.repeatsigns.right.style',
      'extract.{extract}.layout.jumpline_anchor',
      'extract.{extract}.layout.jumpline_vcut',
    ]),
  ],
  instrument_specific: INSTRUMENT_SPECIFIC_FORM_SECTIONS,
  stringnames: [
    createFormSection('stringnames', 'Saitennamen', STRINGNAMES_FORM_KEYS),
  ],
  template: [
    createFormSection('template', 'Vorlage', [
      'template.filebase',
      'template.title',
    ]),
  ],
  validationerrors: [
    createFormSection('validationerrors', 'Konfigurationsfehler', []),
  ],
  all_parameters: [
    createFormSection('all_parameters', 'Alle Parameter', ['.']),
  ],
}

export const CONFIG_EDITOR_MENU_ITEMS: ConfigEditorMenuItem[] = [
  { type: 'command', id: 'extract_annotation', legacyText: 'Extract-Annotation', legacyIcon: 'fa fa-bars', label: 'Auszugsbeschriftung', title: 'Auszugsbeschriftungen bearbeiten' },
  { type: 'command', id: 'notes', legacyText: 'page annotation', legacyIcon: 'fa fa-file-text-o', label: 'Seitenbeschriftung', title: 'Einstellungen fuer Seitenbeschriftung im aktuellen Auszug bearbeiten' },
  { type: 'separator' },
  { type: 'command', id: 'basic_settings', legacyText: 'basic settings', legacyIcon: 'fa fa-heartbeat', label: 'Grundeinstellungen', title: 'Grundeinstellungen des Auszugs bearbeiten' },
  { type: 'command', id: 'lyrics', legacyText: 'lyrics', legacyIcon: 'fa fa-font', label: 'Liedtexte', title: 'Einstellungen fuer Liedtexte im aktuellen Auszug bearbeiten' },
  { type: 'command', id: 'layout', legacyText: 'layout', legacyIcon: 'fa fa-align-center', label: 'Layout', title: 'Layout-Parameter im aktuellen Auszug bearbeiten' },
  { type: 'command', id: 'instrument_specific', legacyText: 'instrument specific', legacyIcon: 'fa fa-pie-chart', label: 'Intrumentspezifika', title: 'Instrumentenspezifische Groessen und Darstellung bearbeiten' },
  { type: 'separator' },
  { type: 'command', id: 'barnumbers_countnotes', legacyText: 'barnumbers and countnotes', legacyIcon: 'fa fa-list-ol', label: 'Taktnummer und Zaehlmarken', title: 'Taktnummern und Zaehlmarken bearbeiten' },
  { type: 'command', id: 'repeatsigns', legacyText: 'repeat signs', legacyIcon: 'fa fa-repeat', label: 'Wiederholungszeichen', title: 'Darstellung der Wiederholungszeichen bearbeiten' },
  { type: 'command', id: 'annotations', legacyText: 'annotations', legacyIcon: 'fa fa-commenting-o', label: 'Notenbeschriftungsvorlagen', title: 'Globale Beschriftungen bearbeiten' },
  { type: 'separator' },
  { type: 'command', id: 'stringnames', legacyText: 'stringnames', legacyIcon: 'fa fa-ellipsis-h', label: 'Saitennamen', title: 'Darstellung der Saitennamen bearbeiten' },
  { type: 'command', id: 'printer', legacyText: 'Printer adapt', legacyIcon: 'fa fa-print', label: 'Druckeranpassungen', title: 'Drucker-Korrekturparameter bearbeiten' },
  { type: 'command', id: 'notebound', legacyText: 'notebound', legacyIcon: 'fa fa-adjust', label: 'Notenbezogen', title: 'Notengebundene Einstellungen bearbeiten' },
  { type: 'command', id: 'images', legacyText: 'images', legacyIcon: 'fa fa-image', label: 'Bilder', title: 'Position von Bildern bearbeiten' },
  { type: 'separator' },
  { type: 'command', id: 'validationerrors', legacyText: 'validationerrors', legacyIcon: 'fa fa-exclamation-circle', label: 'Konfigurationsfehler', title: 'Fehlerhafte Konfigurationsparameter korrigieren' },
  { type: 'separator' },
  { type: 'command', id: 'all_parameters', legacyText: 'all parameters', legacyIcon: 'fa fa-list', label: 'Alle Parameter', title: 'Gesamtkonfiguration bearbeiten' },
  { type: 'command', id: 'template', legacyText: 'configtemplate', legacyIcon: 'fa fa-pencil-square-o', label: 'Vorlage konfigurieren', title: 'Konfiguration fuer Dateivorlage bearbeiten' },
]

export const CONFIG_EDITOR_FORM_SETS: Record<ConfigEditorFormId, ConfigEditorFormSet> = {
  basic_settings: {
    id: 'basic_settings',
    scope: 'mixed',
    supportsNewEntry: false,
    keys: [
      'produce',
      'extract.{extract}.title',
      'extract.{extract}.filenamepart',
      'extract.{extract}.voices',
      'extract.{extract}.flowlines',
      'extract.{extract}.subflowlines',
      'extract.{extract}.synchlines',
      'extract.{extract}.jumplines',
      'extract.{extract}.layoutlines',
      'extract.{extract}.nonflowrest',
      'extract.{extract}.startpos',
      'extract.{extract}.repeatsigns.voices',
      'extract.{extract}.barnumbers.voices',
      'extract.{extract}.countnotes.voices',
      'extract.{extract}.stringnames.vpos',
      'extract.{extract}.sortmark.show',
      'restposition',
    ],
    sections: CONFIG_EDITOR_FORM_SECTIONS.basic_settings,
  },
  extract_annotation: {
    id: 'extract_annotation',
    scope: 'global',
    quicksettingCommands: ['stdextract'],
    supportsNewEntry: true,
    newEntryCommand: 'extracts',
    keys: [
      'produce',
      'extract.{extract}.title',
      'extract.{extract}.voices',
      'extract.{extract}.filenamepart',
    ],
    sections: CONFIG_EDITOR_FORM_SECTIONS.extract_annotation,
  },
  barnumbers_countnotes: {
    id: 'barnumbers_countnotes',
    scope: 'extract',
    supportsNewEntry: false,
    quicksettingCommands: ['preset.barnumbers_countnotes'],
    keys: [...BARNUMBERS_COUNTNOTES_FORM_KEYS],
    sections: CONFIG_EDITOR_FORM_SECTIONS.barnumbers_countnotes,
  },
  annotations: {
    id: 'annotations',
    scope: 'global',
    supportsNewEntry: true,
    newEntryCommand: 'annotations',
    keys: ['annotations'],
    sections: CONFIG_EDITOR_FORM_SECTIONS.annotations,
  },
  notes: {
    id: 'notes',
    scope: 'extract',
    supportsNewEntry: true,
    quicksettingCommands: ['preset.notes'],
    newEntryCommand: 'notes',
    keys: [...NOTES_FORM_KEYS],
    sections: CONFIG_EDITOR_FORM_SECTIONS.notes,
  },
  lyrics: {
    id: 'lyrics',
    scope: 'extract',
    supportsNewEntry: true,
    newEntryCommand: 'lyrics',
    newEntryExtractZeroOnly: true,
    keys: [...LYRICS_FORM_KEYS],
    sections: CONFIG_EDITOR_FORM_SECTIONS.lyrics,
  },
  images: {
    id: 'images',
    scope: 'mixed',
    supportsNewEntry: true,
    newEntryCommand: 'images',
    newEntryExtractZeroOnly: true,
    quicksettingCommands: ['preset.images'],
    keys: [
      '$resources.*',
      'extract.{extract}.images.*.imagename',
      'extract.{extract}.images.*.show',
      'extract.{extract}.images.*.pos',
      'extract.{extract}.images.*.height',
    ],
    sections: CONFIG_EDITOR_FORM_SECTIONS.images,
  },
  notebound: {
    id: 'notebound',
    scope: 'extract',
    supportsNewEntry: false,
    keys: ['extract.{extract}.notebound'],
    sections: CONFIG_EDITOR_FORM_SECTIONS.notebound,
  },
  layout: {
    id: 'layout',
    scope: 'extract',
    supportsNewEntry: false,
    quicksettingCommands: ['preset.layout'],
    keys: [...LAYOUT_FORM_KEYS],
    sections: CONFIG_EDITOR_FORM_SECTIONS.layout,
  },
  printer: {
    id: 'printer',
    scope: 'extract',
    supportsNewEntry: false,
    quicksettingCommands: ['preset.printer'],
    keys: [...PRINTER_FORM_KEYS],
    sections: CONFIG_EDITOR_FORM_SECTIONS.printer,
  },
  repeatsigns: {
    id: 'repeatsigns',
    scope: 'extract',
    supportsNewEntry: false,
    keys: [
      'extract.{extract}.repeatsigns.voices',
      'extract.{extract}.repeatsigns.left.pos',
      'extract.{extract}.repeatsigns.left.text',
      'extract.{extract}.repeatsigns.left.style',
      'extract.{extract}.repeatsigns.right.pos',
      'extract.{extract}.repeatsigns.right.text',
      'extract.{extract}.repeatsigns.right.style',
      'extract.{extract}.layout.jumpline_anchor',
      'extract.{extract}.layout.jumpline_vcut',
    ],
    sections: CONFIG_EDITOR_FORM_SECTIONS.repeatsigns,
  },
  instrument_specific: {
    id: 'instrument_specific',
    scope: 'extract',
    supportsNewEntry: false,
    quicksettingCommands: ['preset.instrument'],
    keys: [...INSTRUMENT_SPECIFIC_FORM_KEYS],
    sections: INSTRUMENT_SPECIFIC_FORM_SECTIONS,
  },
  stringnames: {
    id: 'stringnames',
    scope: 'extract',
    supportsNewEntry: false,
    keys: [...STRINGNAMES_FORM_KEYS],
    sections: CONFIG_EDITOR_FORM_SECTIONS.stringnames,
  },
  template: {
    id: 'template',
    scope: 'global',
    supportsNewEntry: false,
    keys: [
      'template.filebase',
      'template.title',
    ],
    sections: CONFIG_EDITOR_FORM_SECTIONS.template,
  },
  validationerrors: {
    id: 'validationerrors',
    scope: 'global',
    supportsNewEntry: false,
    keys: [],
    sections: CONFIG_EDITOR_FORM_SECTIONS.validationerrors,
  },
  all_parameters: {
    id: 'all_parameters',
    scope: 'global',
    quicksettingCommands: ['stdextract'],
    supportsNewEntry: false,
    keys: ['.'],
    sections: CONFIG_EDITOR_FORM_SECTIONS.all_parameters,
  },
}

export function getConfigEditorFormSet(formId: string): ConfigEditorFormSet | undefined {
  if (isConfigEditorFormId(formId)) return CONFIG_EDITOR_FORM_SETS[formId]
  return undefined
}

/** Liefert das Legacy-Formular zu einem konkreten Konfigurationspfad. */
export function resolveConfigEditorFormId(path: string): ConfigEditorFormId | undefined {
  if (isConfigEditorFormId(path)) return path
  if (getConfigEditorDynamicFields(path) !== undefined) return undefined

  const pathParts = normalizeConfigEditorPath(path).split('.')
  for (const formSet of Object.values(CONFIG_EDITOR_FORM_SETS)) {
    if (formSet.id === 'all_parameters' || formSet.id === 'template') continue
    if (formSet.keys.some((key) => matchesConfigEditorPathPrefix(pathParts, key))) return formSet.id
  }
  return undefined
}

function normalizeConfigEditorPath(path: string): string {
  return path.replace(/^extract\.(?:current|\d+)(?=\.|$)/, 'extract.{extract}')
}

function matchesConfigEditorPathPrefix(pathParts: string[], key: string): boolean {
  const keyParts = key.split('.')
  if (pathParts.length > keyParts.length) return false
  return pathParts.every((part, index) => {
    const keyPart = keyParts[index]
    return keyPart === '*' || keyPart === '{extract}' || keyPart === part
  })
}

export function isConfigEditorFormId(formId: string): formId is ConfigEditorFormId {
  return formId in CONFIG_EDITOR_FORM_SETS
}

export function getConfigEditorFormSections(formId: string): ConfigEditorFormSection[] | undefined {
  return getConfigEditorFormSet(formId)?.sections
}

/**
 * Liefert das Legacy-Formset für einen dynamischen Konfigurationspfad.
 * Die regulären Formsets werden vor den statischen Formularen geprüft.
 */
export function getConfigEditorDynamicFields(path: string): readonly string[] | undefined {
  if (/^extract\.(?:current|\d+)\.notebound\.flowline\.v_\d+\.\d+$/.test(path)) return ['cp1', 'cp2', 'show']
  if (/^extract\.(?:current|\d+)\.notebound\.tuplet\.v_\d+\.\w+$/.test(path)) {
    return ['show', 'pos', 'shape', 'cp1', 'cp2']
  }
  if (/^extract\.(?:current|\d+)\.notebound\.(?:chord|annotation|partname|decoration)\.v_\d+\.\d+(?:\.\d+)?$/.test(path)) {
    return ['show', 'pos', 'style']
  }
  if (/^extract\.(?:current|\d+)\.notebound\.decoration\.v_\d+\.t_\d+\.\d+$/.test(path)) {
    return ['show', 'pos', 'style']
  }
  if (/^extract\.(?:current|\d+)\.notebound\.minc\.\d+$/.test(path)) return ['minc_f']
  if (/^extract\.(?:current|\d+)\.notebound\.nconf\.v_\d+\.t_\d+\.n_\d+$/.test(path)) return ['nshift']
  return undefined
}

/**
 * Liefert die fachliche Beschriftung einer Schnelleinstellung.
 *
 * Die Preset-IDs bleiben aus Kompatibilitätsgründen technisch; für die UI
 * wird die vorhandene deutsche Fachübersetzung verwendet.
 */
export function getConfigEditorQuickSettingLabel(command: string): string {
  const key = command.startsWith('preset.')
    ? command.slice(command.lastIndexOf('.') + 1)
    : command
  const translations: Record<string, string> = abc2svgTextrans
  return translations[key] ?? key
}

export function getConfigEditorNewEntryCommand(
  formId: string,
  extractId: number,
): string | undefined {
  const formSet = getConfigEditorFormSet(formId)
  if (formSet?.supportsNewEntry !== true) return undefined
  if (formSet.newEntryCommand === undefined) return undefined
  if (formSet.newEntryExtractZeroOnly === true && extractId !== 0) return undefined
  return formSet.newEntryCommand
}
