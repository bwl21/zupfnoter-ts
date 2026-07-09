/**
 * Legacy-nahe Konfiguration der Perspektiven im Konfigurationseditor.
 *
 * Portiert aus `ConfstackEditor.get_config_form_menu_entries` in
 * `config-form.rb` und aus den `form_sets` des Legacy-Kommandos `editconf`
 * in `controller_command_definitions.rb`.
 */

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
  },
  extract_annotation: {
    id: 'extract_annotation',
    scope: 'global',
    quicksettingCommands: ['stdextract'],
    supportsNewEntry: true,
    keys: [
      'produce',
      'extract.{extract}.title',
      'extract.{extract}.voices',
      'extract.{extract}.filenamepart',
    ],
  },
  barnumbers_countnotes: {
    id: 'barnumbers_countnotes',
    scope: 'extract',
    supportsNewEntry: false,
    keys: [
      'extract.{extract}.barnumbers.voices',
      'extract.{extract}.barnumbers.pos',
      'extract.{extract}.barnumbers.autopos',
      'extract.{extract}.barnumbers.apanchor',
      'extract.{extract}.barnumbers.apbase',
      'extract.{extract}.barnumbers.style',
      'extract.{extract}.countnotes.voices',
      'extract.{extract}.countnotes.pos',
      'extract.{extract}.countnotes.autopos',
      'extract.{extract}.countnotes.apanchor',
      'extract.{extract}.countnotes.apbase',
      'extract.{extract}.countnotes.style',
      'extract.{extract}.countnotes.cntextleft',
      'extract.{extract}.countnotes.cntextright',
      'extract.{extract}.chords.voices',
      'extract.{extract}.chords.pos',
      'extract.{extract}.chords.style',
      'extract.{extract}.tuplets.text',
      'extract.{extract}.tuplets.style',
    ],
  },
  annotations: {
    id: 'annotations',
    scope: 'global',
    supportsNewEntry: true,
    keys: ['annotations'],
  },
  notes: {
    id: 'notes',
    scope: 'extract',
    supportsNewEntry: true,
    keys: [
      'extract.{extract}.legend.pos',
      'extract.{extract}.legend.align',
      'extract.{extract}.legend.spos',
      'extract.{extract}.notes',
    ],
  },
  lyrics: {
    id: 'lyrics',
    scope: 'extract',
    supportsNewEntry: true,
    keys: [
      'extract.{extract}.lyrics.*.verses',
      'extract.{extract}.lyrics.*.pos',
      'extract.{extract}.lyrics.*.style',
    ],
  },
  images: {
    id: 'images',
    scope: 'mixed',
    supportsNewEntry: true,
    keys: [
      '$resources.*',
      'extract.{extract}.images.*.imagename',
      'extract.{extract}.images.*.show',
      'extract.{extract}.images.*.pos',
      'extract.{extract}.images.*.height',
    ],
  },
  notebound: {
    id: 'notebound',
    scope: 'extract',
    supportsNewEntry: false,
    keys: ['extract.{extract}.notebound'],
  },
  layout: {
    id: 'layout',
    scope: 'extract',
    supportsNewEntry: false,
    keys: [
      'extract.{extract}.layoutlines',
      'extract.{extract}.startpos',
      'extract.{extract}.layout.LINE_THIN',
      'extract.{extract}.layout.LINE_MEDIUM',
      'extract.{extract}.layout.LINE_THICK',
      'extract.{extract}.layout.ELLIPSE_SIZE',
      'extract.{extract}.layout.REST_SIZE',
      'extract.{extract}.layout.limit_a3',
      'extract.{extract}.layout.DRAWING_AREA_SIZE',
      'extract.{extract}.layout.packer.pack_method',
      'extract.{extract}.layout.packer.pack_max_spreadfactor',
      'extract.{extract}.layout.packer.pack_min_increment',
      'extract.{extract}.layout.jumpline_anchor',
      'extract.{extract}.layout.jumpline_vcut',
      'extract.{extract}.layout.color.color_default',
      'extract.{extract}.layout.color.color_variant1',
      'extract.{extract}.layout.color.color_variant2',
      'extract.{extract}.layout.bottomup',
      'extract.{extract}.layout.beams',
    ],
  },
  printer: {
    id: 'printer',
    scope: 'extract',
    supportsNewEntry: false,
    keys: [
      'extract.{extract}.printer',
      'extract.{extract}.printer.show_border',
      'extract.{extract}.layout.limit_a3',
    ],
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
  },
  instrument_specific: {
    id: 'instrument_specific',
    scope: 'extract',
    supportsNewEntry: false,
    keys: [
      'extract.{extract}.layout.instrument',
      'extract.{extract}.layout.tuning',
      'extract.{extract}.layout.limit_a3',
      'extract.{extract}.layout.bottomup',
      'extract.{extract}.layout.beams',
      'extract.{extract}.layout.X_OFFSET',
      'extract.{extract}.layout.X_SPACING',
      'extract.{extract}.layout.PITCH_OFFSET',
      'extract.{extract}.stringnames.text',
      'extract.{extract}.printer.a3_offset',
      'extract.{extract}.printer.a4_offset',
      'extract.{extract}.printer.a4_pages',
      'extract.{extract}.printer.show_border',
      'extract.{extract}.stringnames.marks.hpos',
      'extract.{extract}.stringnames.marks.vpos',
    ],
  },
  stringnames: {
    id: 'stringnames',
    scope: 'extract',
    supportsNewEntry: false,
    keys: [
      'extract.{extract}.stringnames',
      'extract.{extract}.sortmark',
    ],
  },
  template: {
    id: 'template',
    scope: 'global',
    supportsNewEntry: false,
    keys: [
      'template.filebase',
      'template.title',
    ],
  },
  validationerrors: {
    id: 'validationerrors',
    scope: 'global',
    supportsNewEntry: false,
    keys: [],
  },
  all_parameters: {
    id: 'all_parameters',
    scope: 'global',
    quicksettingCommands: ['stdextract'],
    supportsNewEntry: false,
    keys: ['.'],
  },
}

export function getConfigEditorFormSet(formId: string): ConfigEditorFormSet | undefined {
  if (isConfigEditorFormId(formId)) return CONFIG_EDITOR_FORM_SETS[formId]
  return undefined
}

export function isConfigEditorFormId(formId: string): formId is ConfigEditorFormId {
  return formId in CONFIG_EDITOR_FORM_SETS
}
