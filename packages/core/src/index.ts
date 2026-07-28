/**
 * @zupfnoter/core – Public API
 *
 * Exports the transformation pipeline classes for Stufe 1 (ABC → Song).
 * AbcModel is intentionally NOT exported — it is an internal implementation
 * detail of AbcParser.
 */

export { AbcParser } from './AbcParser.js'
export type { AbcParseError } from './AbcParser.js'

export { AbcToSong } from './AbcToSong.js'
export { exportSongToAbc } from './SongToAbc.js'

export { Confstack, DeleteMe } from './Confstack.js'
export type { ConfigObject, ConfigValue } from './Confstack.js'

export { buildConfstack } from './buildConfstack.js'

export { computeBeatCompression } from './BeatPacker.js'
export type { BeatCompressionMap } from './BeatPacker.js'

export { HarpnotesLayout } from './HarpnotesLayout.js'
export {
  HeuristicAnnotationTextMetrics,
  JsPdfAnnotationTextMetrics,
  createJsPdfAnnotationTextMetrics,
  createDefaultAnnotationTextMetrics,
} from './TextMetrics.js'
export type { HarpnotesLayoutOptions, AnnotationTextMetrics, JsPdfConstructor } from './TextMetrics.js'

export { SvgEngine } from './SvgEngine.js'
export type { SvgEngineOptions } from './SvgEngine.js'
export { makeJumplinePathData } from './jumplinePath.js'
export type { JumplinePathData, JumplinePathInfo } from './jumplinePath.js'
export { bezierControlToLegacyValue, makeBezierPathData } from './bezierPath.js'
export type { BezierPathInfo } from './bezierPath.js'
export { PdfEngine } from './PdfEngine.js'
export { PLAYER_QR_IMAGE_NAME, isPlayerQrImageName } from './imageResources.js'
export { createPlayerQrJpeg, playerQrJpegDataUrl } from './playerQr.js'
export { pdfOutputFilename } from './PdfOutputName.js'
export type { PdfPageFormat } from './PdfOutputName.js'

export { expandPlaybackFlow } from './PlaybackFlow.js'
export { extractLyricsText, replaceLyricsText } from './lyrics.js'
export { buildPlaybackTimeline, resolveBaseTempoFromSong, resolveTempoUnitFromSong } from './PlaybackTimeline.js'
export { buildPlaybackExportData, buildPlaybackExportDataFromTimeline } from './PlaybackExport.js'
export type { PlaybackExportData, PlaybackExportEvent, PlaybackExportMarker } from './PlaybackExport.js'

export { GLYPHS } from './glyphs.js'
export type { GlyphDef } from './glyphs.js'

export { initConf } from './initConf.js'
export {
  buildConfigSchemaOverview,
  getConfigMenuKind,
  getConfigSchemaOverview,
  getConfigPathActionProfile,
  resolveConfigSchemaPath,
  LEGACY_BARNUMBERS_EXTRACT_PATH_SUFFIXES,
  LEGACY_COUNTNOTES_EXTRACT_PATH_SUFFIXES,
  hasConfigPathSegment,
  isLegacyTopLevelConfigKey,
  isSelectableConfigPath,
  LEGACY_CONFIG_MENU_PATH_SEGMENTS,
  LEGACY_LAYOUT_EXTRACT_PATH_SUFFIXES,
  LEGACY_LAYOUT_PACKER_EXTRACT_PATH_SUFFIXES,
  LEGACY_LYRICS_EXTRACT_PATH_SUFFIX_PATTERNS,
  LEGACY_NOTES_EXTRACT_PATH_SUFFIXES,
  LEGACY_PRINTER_EXTRACT_PATH_SUFFIXES,
  LEGACY_SELECTABLE_CONFIG_PATH_SEGMENTS,
  LEGACY_STRINGNAMES_EXTRACT_PATH_SUFFIXES,
  toExtractConfigPath,
  validateCompleteZupfnoterConfigShape,
  validateEmbeddedZupfnoterConfigShape,
  validateZupfnoterConfigShape,
  ZUPFNOTER_CONFIG_SCHEMA_DRAFT,
  ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW,
  ZUPFNOTER_CONFIG_SCHEMA_URI,
  ZUPFNOTER_EXTRACT_KEY_PATTERN,
  ZUPFNOTER_EXTRACT_REQUIRED_KEYS,
  ZUPFNOTER_LAYOUT_CORE_KEYS,
  ZUPFNOTER_PRINTER_KEYS,
  ZUPFNOTER_PRINTER_REQUIRED_KEYS,
  ZUPFNOTER_TOP_LEVEL_REQUIRED_KEYS,
} from './configSchema.js'
export type {
  ConfigMenuKind,
  ConfigPathActionProfile,
  ConfigEditorOption,
  ConfigEditorSchemaMetadata,
  ConfigEditorStrategy,
  ConfigSchemaValidationOptions,
  JsonSchemaNode,
} from './configSchema.js'

export {
  CONFIG_EDITOR_FORM_SETS,
  CONFIG_EDITOR_MENU_ITEMS,
  getConfigEditorFormSet,
  getConfigEditorNewEntryCommand,
  getConfigEditorDynamicFields,
  getConfigEditorFormSections,
  getConfigEditorQuickSettingLabel,
  isConfigEditorFormId,
} from './configEditorForms.js'
export type {
  ConfigEditorFormId,
  ConfigEditorFormSection,
  ConfigEditorFormSet,
  ConfigEditorMenuCommand,
  ConfigEditorMenuItem,
  ConfigEditorMenuSeparator,
} from './configEditorForms.js'
export {
  buildConfigEditorAllParametersTree,
  buildConfigEditorSectionTree,
  configEditorKeyToTreePath,
  CONFIG_EDITOR_TREE_DEFINITION,
  findConfigEditorTreeDefinition,
} from './configEditorTree.js'
export type { ConfigEditorTreeDefinition } from './configEditorTree.js'
export {
  formatConfigEditorValue,
  parseConfigEditorValue,
  serializeConfigEditorValue,
} from './configEditorValue.js'
export type { ConfigEditorValueParseResult } from './configEditorValue.js'

export {
  extractSongConfig,
  extractSongFilebase,
  extractSongResources,
  mergeSongConfig,
  replaceSongDocumentAbc,
  replaceSongDocumentResources,
  splitSongDocument,
  CONFIG_SEPARATOR,
  RESOURCES_SECTION,
} from './extractSongConfig.js'
export type { SongDocumentParts } from './extractSongConfig.js'

export {
  CommandError,
  CommandStack,
  parseCommandString,
} from './commands.js'
export type {
  CommandArgumentValue,
  CommandArguments,
  CommandContext,
  CommandDefinition,
  CommandHistoryEntry,
  CommandParameter,
  CommandResult,
} from './commands.js'

export {
  createLegacyCommandStack,
  registerLegacyCommands,
} from './legacyCommands.js'
export type { WorkbenchCommandRuntime } from './legacyCommands.js'

export {
  registerStorageCommands,
  StorageTargetUnavailableError,
} from './storageCommands.js'
export type {
  StorageCommandRuntime,
  StorageCommandState,
} from './storageCommands.js'
