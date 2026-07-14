import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  faBullseye,
  faChevronDown,
  faChevronRight,
  faDownload,
  faEllipsis,
  faRotateLeft,
  faRotateRight,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { faCircleQuestion } from '@fortawesome/free-regular-svg-icons'

export type ZnIconName =
  | 'collapse'
  | 'delete'
  | 'expand'
  | 'fill'
  | 'help'
  | 'menu'
  | 'redo'
  | 'select'
  | 'undo'

/** Zupfnoter-Schlüssel auf die zugehörige Font-Awesome-Definition. */
export const ZN_ICONS: Record<ZnIconName, IconDefinition> = {
  collapse: faChevronDown,
  delete: faTrash,
  expand: faChevronRight,
  fill: faDownload,
  help: faCircleQuestion,
  menu: faEllipsis,
  redo: faRotateRight,
  select: faBullseye,
  undo: faRotateLeft,
}
