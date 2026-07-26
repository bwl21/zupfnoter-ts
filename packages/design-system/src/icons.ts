import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  faBullseye,
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowUp,
  faArrowsUpDown,
  faChevronDown,
  faChevronRight,
  faDownload,
  faEllipsis,
  faGear,
  faPen,
  faRotateLeft,
  faRotateRight,
  faShareNodes,
  faSquarePlus,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { faCircleQuestion, faStar } from '@fortawesome/free-regular-svg-icons'

export type ZnIconName =
  | 'collapse'
  | 'delete'
  | 'edit'
  | 'expand'
  | 'fill'
  | 'help'
  | 'newEntry'
  | 'menu'
  | 'quickSettings'
  | 'redo'
  | 'select'
  | 'share'
  | 'shiftDown'
  | 'shiftLeft'
  | 'shiftRight'
  | 'shiftUp'
  | 'settings'
  | 'undo'
  | 'verticalAdjust'

/** Zupfnoter-Schlüssel auf die zugehörige Font-Awesome-Definition. */
export const ZN_ICONS: Record<ZnIconName, IconDefinition> = {
  collapse: faChevronDown,
  shiftDown: faArrowDown,
  shiftLeft: faArrowLeft,
  shiftRight: faArrowRight,
  shiftUp: faArrowUp,
  settings: faGear,
  verticalAdjust: faArrowsUpDown,
  delete: faTrash,
  edit: faPen,
  expand: faChevronRight,
  fill: faDownload,
  help: faCircleQuestion,
  menu: faEllipsis,
  newEntry: faSquarePlus,
  quickSettings: faStar,
  redo: faRotateRight,
  select: faBullseye,
  share: faShareNodes,
  undo: faRotateLeft,
}
