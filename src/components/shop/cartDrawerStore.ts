import { createStore } from '@tanstack/react-store'

/**
 * Tiny store that controls the global cart drawer's open state. Kept in a
 * module rather than React context so any component — the navbar button,
 * the "Add to cart" button on the PDP, etc. — can trigger it without
 * threading props.
 */
export const cartDrawerStore = createStore({ open: false }, ({ setState }) => ({
  setOpen: (open: boolean) => setState(() => ({ open })),
  openDrawer: () => setState(() => ({ open: true })),
  closeDrawer: () => setState(() => ({ open: false })),
}))
