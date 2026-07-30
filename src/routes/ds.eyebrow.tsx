import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Sparkle, GitBranch, Database } from '@phosphor-icons/react'
import { seo } from '~/utils/seo'
import { Eyebrow } from '~/components/ds/ui'
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'
import type { LibraryId } from '~/libraries/ids'

// Libraries that ship a --color-lib-* brand token (the rest fall back to neutral).
const BRAND_LIBRARIES: Array<LibraryId> = [
  'start',
  'router',
  'query',
  'table',
  'db',
  'ai',
  'form',
  'virtual',
  'pacer',
  'hotkeys',
  'store',
  'devtools',
  'cli',
  'intent',
]

function EyebrowPlayground() {
  const [library, setLibrary] = React.useState<LibraryId>('query')
  const [branded, setBranded] = React.useState(true)

  return (
    <div className="rounded-xl border border-border-default bg-background-surface p-6">
      <div className="flex flex-wrap items-center gap-5">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={branded}
            onChange={(e) => setBranded(e.target.checked)}
            className="h-4 w-4 accent-ds-blue-400"
          />
          Branded by category
        </label>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          Category
          <select
            value={library}
            disabled={!branded}
            onChange={(e) => setLibrary(e.target.value as LibraryId)}
            className="rounded-lg border border-border-default bg-background-default px-3 py-1.5 text-sm text-text-primary transition disabled:opacity-40"
          >
            {BRAND_LIBRARIES.map((id) => (
              <option key={id} value={id}>
                {id[0].toUpperCase() + id.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 border-t border-border-subtle pt-6">
        <Eyebrow
          icon={<Sparkle size={14} />}
          library={branded ? library : undefined}
        >
          {branded ? `${library} · section kicker` : 'section kicker'}
        </Eyebrow>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/ds/eyebrow')({
  component: EyebrowPage,
  head: () => ({
    meta: seo({
      title: 'Eyebrow | TanStack Design System',
      description:
        'The Eyebrow component — the small uppercase kicker above a section heading.',
    }),
  }),
})

const TONES = ['secondary', 'muted', 'accent'] as const

function EyebrowPage() {
  return (
    <DsPage
      title="Eyebrow"
      description="The small uppercase label that sits above a section heading. Locks in the DS mono-caps role (IBM Plex Mono · 12px · +1.5px tracking) and the inline icon layout, so every kicker across library pages stays on-system. Source: src/components/ds/ui/index.tsx."
    >
      <DsSection
        title="Context"
        description="Toggle branding and select the library/category the eyebrow is nested within. When branded, the eyebrow takes that library's --color-lib-* token; when off, it falls back to a neutral tone."
      >
        <EyebrowPlayground />
      </DsSection>

      <DsSection
        title="Tones"
        description="Neutral, accessible colors by default. Secondary is the standard choice."
      >
        <ComponentPreview
          code={`<Eyebrow tone="secondary">Server-state manager</Eyebrow>
<Eyebrow tone="muted">Server-state manager</Eyebrow>
<Eyebrow tone="accent">Server-state manager</Eyebrow>`}
        >
          {TONES.map((tone) => (
            <Eyebrow key={tone} tone={tone}>
              Server-state manager
            </Eyebrow>
          ))}
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="With icon"
        description="An optional leading icon — use Phosphor icons at 14px."
      >
        <ComponentPreview
          code={`<Eyebrow icon={<Sparkle size={14} />}>Why Query</Eyebrow>
<Eyebrow icon={<GitBranch size={14} />}>Cache lifecycle</Eyebrow>`}
        >
          <Eyebrow icon={<Sparkle size={14} />}>Why Query</Eyebrow>
          <Eyebrow icon={<GitBranch size={14} />}>Cache lifecycle</Eyebrow>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Brand accent"
        description="Library pages pass a brand color via className. The label-sm type role stays locked — only the color changes. (Pick a shade that clears text contrast; the lightest library brand tokens are not legible as small text on light surfaces.)"
      >
        <ComponentPreview
          code={`<Eyebrow icon={<Database size={14} />} className="text-lib-cli">
  Server-state manager
</Eyebrow>`}
        >
          <Eyebrow icon={<Database size={14} />} className="text-lib-cli">
            Server-state manager
          </Eyebrow>
        </ComponentPreview>
      </DsSection>
    </DsPage>
  )
}
