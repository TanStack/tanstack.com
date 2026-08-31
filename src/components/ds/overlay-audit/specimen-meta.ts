/**
 * Audited properties of every overlay currently shipping on the site.
 * Read off the source, not inferred — each `source` path is the original.
 */

export type Posture =
  | 'centered'
  | 'anchored-panel'
  | 'edge-sheet'
  | 'bottom-sheet'
  | 'top-anchored'
  | 'full-bleed'

export type Base = 'radix' | 'hand-rolled'

export type TokenLayer = 'semantic' | 'raw-tailwind' | 'shop-scope'

export type SpecimenMeta = {
  id: string
  name: string
  source: string
  sourceLines: number
  posture: Posture
  base: Base
  tokens: TokenLayer
  zIndex: string
  overlay: string
  width: string
  /** Radix supplies these for free; hand-rolled dialogs must implement them. */
  focusTrap: boolean
  focusRestore: boolean
  escape: boolean
  scrollLock: boolean
  animated: boolean
  notes: string
}

export const SPECIMENS: Array<SpecimenMeta> = [
  {
    id: 'login',
    name: 'LoginModal',
    source: 'src/components/LoginModal.tsx',
    sourceLines: 73,
    posture: 'centered',
    base: 'radix',
    tokens: 'raw-tailwind',
    zIndex: '999 / 1000',
    overlay: 'bg-black/60 backdrop-blur-sm',
    width: 'max-w-xs',
    focusTrap: true,
    focusRestore: true,
    escape: true,
    scrollLock: true,
    animated: false,
    notes:
      'The baseline centered panel. Identical shell to AvatarCropModal and the npm stats dialog apart from max-width.',
  },
  {
    id: 'avatar-crop',
    name: 'AvatarCropModal',
    source: 'src/components/AvatarCropModal.tsx',
    sourceLines: 176,
    posture: 'centered',
    base: 'radix',
    tokens: 'raw-tailwind',
    zIndex: '999 / 1000',
    overlay: 'bg-black/60 backdrop-blur-sm',
    width: 'max-w-md',
    focusTrap: true,
    focusRestore: true,
    escape: true,
    scrollLock: true,
    animated: false,
    notes:
      'Adds a footer action row (Cancel / Save) that no other centered dialog shares — a footer slot the primitive needs.',
  },
  {
    id: 'npm-stats',
    name: 'npm stats dialog',
    source: 'src/routes/stats/npm/index.tsx',
    sourceLines: 40,
    posture: 'centered',
    base: 'radix',
    tokens: 'raw-tailwind',
    zIndex: '999 / 1000',
    overlay: 'bg-black/60 backdrop-blur-sm',
    width: 'max-w-md',
    focusTrap: true,
    focusRestore: true,
    escape: true,
    scrollLock: true,
    animated: false,
    notes:
      'A fourth copy of the same shell, declared inline in a route file. Adds a mobile gutter (w-[calc(100%-1rem)]) the other three lack.',
  },
  {
    id: 'roles-confirm',
    name: 'Roles confirm',
    source: 'src/routes/admin/roles.$roleId.tsx',
    sourceLines: 20,
    posture: 'centered',
    base: 'hand-rolled',
    tokens: 'raw-tailwind',
    zIndex: '50',
    overlay: 'bg-black/50 (no blur)',
    width: 'max-w-md',
    focusTrap: false,
    focusRestore: false,
    escape: false,
    scrollLock: false,
    animated: false,
    notes:
      'Worst case. No portal, no dialog role, no close button, no Escape. A destructive confirm that a keyboard user cannot dismiss.',
  },
  {
    id: 'example-deploy',
    name: 'ExampleDeployDialog',
    source: 'src/components/ExampleDeployDialog.tsx',
    sourceLines: 480,
    posture: 'centered',
    base: 'hand-rolled',
    tokens: 'raw-tailwind',
    zIndex: '50',
    overlay: 'bg-black/50 backdrop-blur-sm',
    width: 'max-w-md',
    focusTrap: false,
    focusRestore: false,
    escape: false,
    scrollLock: false,
    animated: false,
    notes:
      'Tinted header + 5-step wizard body. Shell is byte-identical to StarterDeployDialog.',
  },
  {
    id: 'starter-deploy',
    name: 'Starter DeployDialog',
    source: 'src/components/application-starter/DeployDialog.tsx',
    sourceLines: 585,
    posture: 'centered',
    base: 'hand-rolled',
    tokens: 'raw-tailwind',
    zIndex: '50',
    overlay: 'bg-black/50 backdrop-blur-sm',
    width: 'max-w-md',
    focusTrap: false,
    focusRestore: false,
    escape: false,
    scrollLock: false,
    animated: false,
    notes:
      'The twin. Same shell, same wizard, different provider branding. Strongest extraction case in the audit.',
  },
  {
    id: 'builder-guide',
    name: 'BuilderGuideDialog',
    source: 'src/components/charts/BuilderGuideDialog.tsx',
    sourceLines: 150,
    posture: 'edge-sheet',
    base: 'radix',
    tokens: 'semantic',
    zIndex: '999 / 1000',
    overlay: 'bg-black/45 backdrop-blur-[1px]',
    width: 'inset-3 → sm:max-w-2xl right sheet',
    focusTrap: true,
    focusRestore: true,
    escape: true,
    scrollLock: true,
    animated: false,
    notes:
      'Strongest on tokens and layout — semantic throughout, fixed header over an independently scrolling body, responsive posture change. But its `animate-in / fade-in-0 / slide-in-from-right` classes match ZERO css rules: no tailwindcss-animate plugin is installed. It appears animated in source and is not.',
  },
  {
    id: 'cart-drawer',
    name: 'CartDrawer',
    source: 'src/components/shop/CartDrawer.tsx',
    sourceLines: 257,
    posture: 'anchored-panel',
    base: 'radix',
    tokens: 'shop-scope',
    zIndex: '100',
    overlay: 'bg-black/40 (no blur)',
    width: 'sm:w-[24rem], navbar-anchored',
    focusTrap: true,
    focusRestore: true,
    escape: true,
    scrollLock: true,
    animated: false,
    notes:
      'MIGRATED — now Drawer side="right" size="sm" fit anchor="navbar". Its navbar offset became the DS `anchor` prop, which is the whole of this posture. Keeps its own surface colours by passing shop-scope through className: the primitive supplies posture and behaviour, the shop supplies the palette.',
  },
  {
    id: 'product-drawer',
    name: 'ProductDrawer',
    source: 'src/components/shop/ProductDrawer.tsx',
    sourceLines: 700,
    posture: 'bottom-sheet',
    base: 'hand-rolled',
    tokens: 'shop-scope',
    zIndex: '60 / 70 / 71',
    overlay: 'bg-black/50 backdrop-blur-sm',
    width: 'w-[calc(100%-2rem)] max-w-[1400px]',
    focusTrap: false,
    focusRestore: false,
    escape: true,
    scrollLock: false,
    animated: true,
    notes:
      'MIGRATED — now Drawer side="bottom" fit. Was the last hand-rolled overlay on the site; Radix now supplies the focus trap, focus restoration, Escape and scroll lock it never had. Its prev/next arrows moved from viewport-fixed on a third z-tier to panel-absolute, because Radix traps focus inside the panel and viewport-level siblings would have been unreachable by keyboard.',
  },
  {
    id: 'libraries-overlay',
    name: 'LibrariesOverlay',
    source: 'src/components/LibrariesOverlay.tsx',
    sourceLines: 57,
    posture: 'full-bleed',
    base: 'radix',
    tokens: 'semantic',
    zIndex: '110 / 111 / 112',
    overlay: 'bespoke .libraries-overlay-glass',
    width: 'inset-0',
    focusTrap: true,
    focusRestore: true,
    escape: true,
    scrollLock: true,
    animated: true,
    notes:
      'MIGRATED — now Takeover with scrim="glass". Its bespoke glass treatment became the DS\'s second scrim, which is the pair the audit asked for after finding seven. LibrariesBrowser also dropped its direct Radix import in favour of TakeoverTitle / TakeoverDescription.',
  },
  {
    id: 'search-modal',
    name: 'SearchModal',
    source: 'src/components/SearchModal.tsx',
    sourceLines: 3766,
    posture: 'top-anchored',
    base: 'radix',
    tokens: 'raw-tailwind',
    zIndex: '999 / 1000',
    overlay: 'bg-black/60 → xl:bg-black/30',
    width: 'inset-0 → sm:max-w-4xl top-anchored',
    focusTrap: true,
    focusRestore: true,
    escape: true,
    scrollLock: true,
    animated: true,
    notes:
      'TOKENS ADOPTED, POSTURE NOT EXTRACTED. Now on bg-scrim and the --z-scrim / --z-overlay / --z-above-overlay tiers, which closes the last bespoke values in the audit. The shell itself stays: it is already Radix, already accessible, and already has real data-state animation, so extracting a CommandPalette buys no correctness — and it would need five caller-specific escape hatches (forceMount on Portal/Overlay/Content to keep InstantSearch state alive; animation on an inner panel because Content is a full-bleed hit area on mobile; the top-anchored responsive posture; a conditional sm:bottom-4; and a scrim that lightens at xl). One caller is below the extraction threshold. Revisit if a second command palette appears.',
  },
]

/** Distinct values found per property — the raw material for the token decisions. */
export const DIVERGENCE = [
  {
    property: 'z-index tier',
    values: ['50', '60/70/71', '100', '110/111/112', '999/1000'],
    verdict:
      'Five unrelated stacking families. Now a documented scale — --z-scrim, --z-overlay, and --z-above-overlay for chrome that must float over an open overlay. No overlay declares its own tier any more.',
  },
  {
    property: 'Scrim',
    values: [
      'black/40 no blur',
      'black/50 no blur',
      'black/50 blur-sm',
      'black/45 blur-[1px]',
      'black/60 blur-sm',
      'black/60→30 responsive',
      'bespoke glass',
    ],
    verdict:
      "Seven scrims. Now two, as recommended: --color-scrim for panels, and the glass treatment as Takeover's immersive variant. Only SearchModal still declares its own.",
  },
  {
    property: 'Base',
    values: ['Radix (7)', 'hand-rolled (4)'],
    verdict:
      'The 4 hand-rolled ones accounted for every a11y failure in the audit. All four are now migrated — every overlay on the site is Radix-backed.',
  },
  {
    property: 'Token layer',
    values: ['semantic (2)', 'raw tailwind (7)', 'shop-scope (2)'],
    verdict:
      'Only BuilderGuideDialog and LibrariesOverlay are on the semantic layer.',
  },
  {
    property: 'Animation',
    values: ['real keyframes (3)', 'dead animate-in classes (1)', 'none (7)'],
    verdict:
      'tailwindcss-animate is NOT installed, so every `animate-in` / `fade-in-0` / `zoom-in-95` class in the codebase is inert. Only LibrariesOverlay, SearchModal and ProductDrawer actually move.',
  },
  {
    property: 'Corner radius',
    values: ['rounded-lg', 'rounded-xl', 'rounded-t-2xl', 'rounded-none (sm)'],
    verdict: 'rounded-xl is the de facto standard; one outlier at lg.',
  },
]
