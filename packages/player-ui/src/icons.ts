import { icon } from '@fortawesome/fontawesome-svg-core'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  faBullseye,
  faGear,
  faMinus,
  faPause,
  faPlay,
  faPlus,
  faQrcode,
  faStop,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'

export type PlayerIconName =
  | 'close'
  | 'decrease'
  | 'increase'
  | 'pause'
  | 'play'
  | 'scan'
  | 'settings'
  | 'stop'
  | 'takePosition'

const PLAYER_ICONS: Record<PlayerIconName, IconDefinition> = {
  close: faXmark,
  decrease: faMinus,
  increase: faPlus,
  pause: faPause,
  play: faPlay,
  scan: faQrcode,
  settings: faGear,
  stop: faStop,
  takePosition: faBullseye,
}

/** Rendert ein statisches Font-Awesome-Symbol für die frameworkfreie Player-UI. */
export function renderPlayerIcon(name: PlayerIconName, className = 'player-icon'): string {
  return icon(PLAYER_ICONS[name], {
    attributes: {
      'aria-hidden': 'true',
      class: className,
      focusable: 'false',
    },
  }).html.join('')
}
