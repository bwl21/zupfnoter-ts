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
