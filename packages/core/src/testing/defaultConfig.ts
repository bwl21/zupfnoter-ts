/**
 * Default-Konfiguration für Tests.
 *
 * Delegiert an `initConf(conf)` — einzige Quelle der Wahrheit.
 */
import { Confstack } from '../Confstack.js'
import { initConf } from '../initConf.js'
import type { ZupfnoterConfig } from '@zupfnoter/types'

const _conf = new Confstack()
export const defaultTestConfig: ZupfnoterConfig = initConf(_conf)
