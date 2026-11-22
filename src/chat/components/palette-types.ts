import type { PaletteCandidate } from '../core/command-palette'

export type PalettePage =
  | {
      type: 'list'
      title: string
      items: PaletteItem[]
      placeholder?: string
      notice?: string
    }
  | {
      type: 'input'
      title: string
      label: string
      initialValue: string
      maxLength: number
      submitLabel: string
      submit: (value: string) => void | Promise<void>
    }
export interface PaletteItem extends PaletteCandidate {
  icon?:
    | 'search'
    | 'chat'
    | 'thread'
    | 'file'
    | 'settings'
    | 'arrow'
    | 'model'
    | 'stop'
    | 'copy'
    | 'fork'
    | 'pin'
    | 'archive'
    | 'rename'
    | 'move'
    | 'plus'
    | 'sun'
    | 'layout'
  shortcut?: string
  run: () => void | PalettePage | Promise<void | PalettePage>
  actions?: () => PalettePage
  // Navigation and existing dialogs run after the palette releases focus.
  afterClose?: boolean
}
export interface PaletteScope {
  id: string
  name: string
  primary: boolean
  available: boolean
  items: PaletteItem[]
  notice?: string
}
