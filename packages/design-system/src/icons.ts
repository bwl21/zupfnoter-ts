import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  faBullseye,
  faChevronDown,
  faChevronRight,
  faDownload,
  faEllipsis,
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
  | 'undo'

/** Zupfnoter-Schlüssel auf die zugehörige Font-Awesome-Definition. */
export const ZN_ICONS: Record<ZnIconName, IconDefinition> = {
  collapse: faChevronDown,
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
