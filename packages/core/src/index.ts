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

export { expandPlaybackFlow } from './PlaybackFlow.js'

export { GLYPHS } from './glyphs.js'
export type { GlyphDef } from './glyphs.js'

export { initConf } from './initConf.js'

export { extractSongConfig, mergeSongConfig, CONFIG_SEPARATOR } from './extractSongConfig.js'

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
} from './storageCommands.js'
export type {
  StorageCommandRuntime,
  StorageCommandState,
} from './storageCommands.js'
