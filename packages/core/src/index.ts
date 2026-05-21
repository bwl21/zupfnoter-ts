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

export { Confstack } from './Confstack.js'
export type { ConfigObject, ConfigValue } from './Confstack.js'

export { buildConfstack } from './buildConfstack.js'

export { computeBeatCompression } from './BeatPacker.js'
export type { BeatCompressionMap } from './BeatPacker.js'

export { HarpnotesLayout } from './HarpnotesLayout.js'
export {
  HeuristicAnnotationTextMetrics,
  JsPdfAnnotationTextMetrics,
  createDefaultAnnotationTextMetrics,
} from './TextMetrics.js'
export type { HarpnotesLayoutOptions, AnnotationTextMetrics } from './TextMetrics.js'

export { SvgEngine } from './SvgEngine.js'
export type { SvgEngineOptions } from './SvgEngine.js'

export { GLYPHS } from './glyphs.js'
export type { GlyphDef } from './glyphs.js'

export { initConf } from './initConf.js'

export { extractSongConfig, mergeSongConfig, CONFIG_SEPARATOR } from './extractSongConfig.js'
