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
