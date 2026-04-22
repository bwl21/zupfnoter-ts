/**
 * Minimal ZupfnoterConfig for use in tests.
 * Only the fields required by AbcToSong are populated.
 */
import type { ZupfnoterConfig } from '@zupfnoter/types'

export const defaultTestConfig: ZupfnoterConfig = {
  layout: {
    ELLIPSE_SIZE: [3.5, 1.7],
    REST_SIZE: [4.0, 2.0],
    LINE_THIN: 0.1,
    LINE_MEDIUM: 0.3,
    LINE_THICK: 0.5,
    Y_SCALE: 1.0,
    X_SPACING: 11.5,
    X_OFFSET: 2.0,
    PITCH_OFFSET: 60,
    SHORTEST_NOTE: 96,
    BEAT_RESOLUTION: 384,
    BEAT_PER_DURATION: 1,
    DRAWING_AREA_SIZE: [400, 282],
    MM_PER_POINT: 0.3528,
    color: {
      color_default: 'black',
      color_variant1: 'red',
      color_variant2: 'blue',
    },
    FONT_STYLE_DEF: {},
    DURATION_TO_STYLE: {} as ZupfnoterConfig['layout']['DURATION_TO_STYLE'],
    instrument: 'Harp',
    packer: { pack_method: 0 },
    limit_a3: false,
    grid: false,
  },
  extract: {
    '0': {
      voices: [1, 2, 3, 4],
      flowlines: [1, 3],
      subflowlines: [2, 4],
      jumplines: [1, 3],
      synchlines: [[1, 2], [3, 4]],
      layoutlines: [1, 2, 3, 4],
      startpos: 15,
    },
  },
  printer: {
    a3Offset: [0, 0],
    a4Offset: [0, 0],
    a4Pages: [0, 1, 2],
    showBorder: false,
  },
}
