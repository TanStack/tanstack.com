import type * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { DsDescription, DsPage, DsSection } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/typography')({
  component: TypographyPage,
  head: () => ({
    meta: seo({
      title: 'Typography | TanStack Design System',
      description:
        'The TanStack type system, sourced from Figma — display, heading, body, label, and mono styles.',
    }),
  }),
})

interface TypeStyle {
  name: string
  cls: string
  spec: string
}

interface TypeGroup {
  title: string
  font: string
  sample: string
  items: Array<TypeStyle>
}

const GROUPS: Array<TypeGroup> = [
  {
    title: 'Display',
    font: 'font-ds-display',
    sample: 'TanStack',
    items: [
      {
        name: 'display/2xl',
        cls: 'text-ds-display-2xl',
        spec: '96 / 96 · Bold · -1',
      },
      {
        name: 'display/xl',
        cls: 'text-ds-display-xl',
        spec: '72 / 76 · Bold · -0.8',
      },
      {
        name: 'display/lg',
        cls: 'text-ds-display-lg',
        spec: '56 / 60 · Bold · -0.5',
      },
      {
        name: 'display/md',
        cls: 'text-ds-display-md',
        spec: '48 / 53 · Medium · -0.3',
      },
      {
        name: 'display/sm',
        cls: 'text-ds-display-sm',
        spec: '40 / 46 · Medium',
      },
    ],
  },
  {
    title: 'Heading',
    font: 'font-ds-display',
    sample: 'Type-safe by default',
    items: [
      { name: 'heading/1', cls: 'text-ds-heading-1', spec: '36 / 41 · Medium' },
      { name: 'heading/2', cls: 'text-ds-heading-2', spec: '28 / 34 · Medium' },
      { name: 'heading/3', cls: 'text-ds-heading-3', spec: '24 / 29 · Bold' },
      { name: 'heading/4', cls: 'text-ds-heading-4', spec: '20 / 25 · Bold' },
      { name: 'heading/5', cls: 'text-ds-heading-5', spec: '16 / 21 · Bold' },
      { name: 'heading/6', cls: 'text-ds-heading-6', spec: '14 / 18 · Medium' },
    ],
  },
  {
    title: 'Body',
    font: 'font-sans',
    sample: 'Headless, type-safe tools for building modern web apps.',
    items: [
      { name: 'body/xl', cls: 'text-ds-body-xl', spec: '20 / 32 · Light' },
      { name: 'body/lg', cls: 'text-ds-body-lg', spec: '18 / 28 · Light' },
      { name: 'body/md', cls: 'text-ds-body-md', spec: '16 / 24 · Light' },
      { name: 'body/sm', cls: 'text-ds-body-sm', spec: '14 / 20 · Regular' },
      { name: 'body/xs', cls: 'text-ds-body-xs', spec: '12 / 17 · Regular' },
    ],
  },
  {
    title: 'Label',
    font: 'font-sans',
    sample: 'Get started',
    items: [
      { name: 'label/lg', cls: 'text-ds-label-lg', spec: '16 / 19 · Medium' },
      { name: 'label/md', cls: 'text-ds-label-md', spec: '14 / 17 · Medium' },
      {
        name: 'label/sm',
        cls: 'text-ds-label-sm',
        spec: '12 / 14 · Medium · +0.5',
      },
    ],
  },
  {
    title: 'Mono',
    font: 'font-ds-mono',
    sample: 'const router = createRouter()',
    items: [
      {
        name: 'mono/display',
        cls: 'text-ds-mono-display',
        spec: '24 / 31 · Regular',
      },
      { name: 'mono/lg', cls: 'text-ds-mono-lg', spec: '18 / 27 · Regular' },
      { name: 'mono/md', cls: 'text-ds-mono-md', spec: '16 / 24 · Light' },
      { name: 'mono/sm', cls: 'text-ds-mono-sm', spec: '14 / 21 · Light' },
      { name: 'mono/xs', cls: 'text-ds-mono-xs', spec: '12 / 16 · Light' },
      { name: 'mono/2xs', cls: 'text-ds-mono-2xs', spec: '10 / 14 · Light' },
      {
        name: 'mono/caps',
        cls: 'text-ds-mono-caps uppercase',
        spec: '12 / 14 · Regular · +1.5 · UPPER',
      },
      {
        name: 'mono/caps-xs',
        cls: 'text-ds-mono-caps-xs uppercase',
        spec: '10 / 12 · Regular · +1.2 · UPPER',
      },
    ],
  },
  {
    title: 'Eyebrow',
    font: 'font-ds-mono',
    sample: 'Introducing',
    items: [
      {
        name: 'eyebrow/lg',
        cls: 'text-ds-eyebrow-lg uppercase',
        spec: '13 / 16 · SemiBold · +2 · UPPER',
      },
      {
        name: 'eyebrow/md',
        cls: 'text-ds-eyebrow-md uppercase',
        spec: '11 / 13 · Medium · +1.75 · UPPER',
      },
    ],
  },
]

const SEMANTIC_HEADINGS: Array<{ cls: string; alias: string }> = [
  { cls: 'h1', alias: '= text-ds-heading-1' },
  { cls: 'h2', alias: '= text-ds-heading-2' },
  { cls: 'h3', alias: '= text-ds-heading-3' },
  { cls: 'h4', alias: '= text-ds-heading-4' },
  { cls: 'h5', alias: '= text-ds-heading-5' },
  { cls: 'h6', alias: '= text-ds-heading-6' },
]

function TypographyPage() {
  return (
    <DsPage
      title="Typography"
      description="The TanStack type system, sourced from Figma and extended for dense product diagrams — 27 styles across five roles. Display & headings use Bricolage Grotesque, body & labels use Inter, and code uses IBM Plex Mono. Each style is a Tailwind text-ds-* utility (size, line-height, tracking, and weight baked in)."
    >
      <DsSection
        title="Font families"
        description="The three families that carry the type system."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <FamilyCard
            name="Bricolage Grotesque"
            token="--font-ds-display"
            className="font-ds-display"
            note="Display & headings"
          />
          <FamilyCard
            name="Inter"
            token="--font-sans"
            className="font-sans"
            note="Body & labels"
          />
          <FamilyCard
            name="IBM Plex Mono"
            token="--font-ds-mono"
            className="font-ds-mono"
            note="Code & mono"
          />
        </div>
      </DsSection>

      {GROUPS.map((group) => (
        <DsSection key={group.title} title={group.title}>
          <div className="grid overflow-hidden rounded-xl border border-border-default lg:grid-cols-2">
            <TypeGroupMode group={group} mode="light" />
            <TypeGroupMode group={group} mode="dark" />
          </div>
        </DsSection>
      ))}

      <DsSection
        title="Documentation roles"
        description="Named text roles keep explanatory copy on the same typography and semantic color tokens throughout the design-system catalog."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <DescriptionRoleCard
            name="Page description"
            variant="page"
            typeToken="body/md"
            colorToken="text-secondary"
          >
            Introduces the purpose and scope of a design-system page.
          </DescriptionRoleCard>
          <DescriptionRoleCard
            name="Section description"
            variant="section"
            typeToken="body/sm"
            colorToken="text-secondary"
          >
            Explains usage, behavior, and guidance for a component section.
          </DescriptionRoleCard>
          <DescriptionRoleCard
            name="Preview description"
            variant="preview"
            typeToken="body/sm"
            colorToken="text-muted"
          >
            Adds compact supporting context inside a component preview.
          </DescriptionRoleCard>
        </div>
      </DsSection>

      <DsSection
        title="Semantic headings"
        description="Convenience classes that bundle the display font with each heading size — apply h1–h6 directly to an element instead of pairing font-ds-display with text-ds-heading-*. Aliases of the heading scale above, defined in app.css."
      >
        <div className="grid overflow-hidden rounded-xl border border-border-default lg:grid-cols-2">
          <SemanticHeadingMode mode="light" />
          <SemanticHeadingMode mode="dark" />
        </div>
      </DsSection>
    </DsPage>
  )
}

function TypeGroupMode({
  group,
  mode,
}: {
  group: TypeGroup
  mode: 'light' | 'dark'
}) {
  return (
    <div
      className={`ds-mode-${mode} min-w-0 bg-background-default text-text-primary ${
        mode === 'dark'
          ? 'border-t border-border-default lg:border-l lg:border-t-0'
          : ''
      }`}
    >
      <div className="border-b border-border-default px-5 py-3 font-ds-mono text-ds-mono-caps-xs uppercase text-text-muted">
        {mode}
      </div>
      <div className="divide-y divide-border-default">
        {group.items.map((item) => (
          <div
            key={item.name}
            className="flex min-w-0 items-baseline justify-between gap-4 bg-background-surface px-5 py-4"
          >
            <span
              className={`${group.font} ${item.cls} min-w-0 truncate text-text-primary`}
            >
              {group.sample}
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-ds-mono text-xs text-text-secondary">
                {item.name}
              </span>
              <span className="block text-[11px] text-text-muted">
                {item.spec}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SemanticHeadingMode({ mode }: { mode: 'light' | 'dark' }) {
  return (
    <div
      className={`ds-mode-${mode} min-w-0 bg-background-default text-text-primary ${
        mode === 'dark'
          ? 'border-t border-border-default lg:border-l lg:border-t-0'
          : ''
      }`}
    >
      <div className="border-b border-border-default px-5 py-3 font-ds-mono text-ds-mono-caps-xs uppercase text-text-muted">
        {mode}
      </div>
      <div className="divide-y divide-border-default">
        {SEMANTIC_HEADINGS.map((heading) => (
          <div
            key={heading.cls}
            className="flex min-w-0 items-baseline justify-between gap-4 bg-background-surface px-5 py-4"
          >
            <span
              className={`${heading.cls} min-w-0 truncate text-text-primary`}
            >
              Type-safe by default
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-ds-mono text-xs text-text-secondary">
                .{heading.cls}
              </span>
              <span className="block text-[11px] text-text-muted">
                {heading.alias}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DescriptionRoleCard({
  children,
  colorToken,
  name,
  variant,
  typeToken,
}: {
  children: React.ReactNode
  colorToken: string
  name: string
  variant: React.ComponentProps<typeof DsDescription>['variant']
  typeToken: string
}) {
  return (
    <div className="rounded-lg border border-border-default bg-background-surface p-4">
      <div className="font-ds-display text-ds-heading-6 text-text-primary">
        {name}
      </div>
      <DsDescription variant={variant} className="mt-2">
        {children}
      </DsDescription>
      <div className="mt-4 font-ds-mono text-ds-mono-2xs text-text-muted">
        {typeToken} · {colorToken}
      </div>
    </div>
  )
}

function FamilyCard({
  name,
  token,
  className,
  note,
}: {
  name: string
  token: string
  className: string
  note: string
}) {
  return (
    <div className="rounded-lg border border-border-default bg-background-surface p-4">
      <div className={`${className} text-lg leading-tight text-text-primary`}>
        {name}
      </div>
      <div className="mt-2 font-ds-mono text-[11px] text-text-muted">
        {token}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-text-muted">
        {note}
      </div>
    </div>
  )
}
