import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  ListIcon,
  SquaresFourIcon,
  ColumnsIcon,
  CaretDownIcon,
  CheckIcon,
} from '@phosphor-icons/react'
import { seo } from '~/utils/seo'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
  type SegmentSize,
} from '~/components/ds/ui'
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/tabs')({
  component: TabsPage,
  head: () => ({
    meta: seo({
      title: 'Tabs | TanStack Design System',
      description:
        'Two tab styles — prominent underline (primary) and compact segmented (secondary) — sharing one accessible API.',
    }),
  }),
})

function TabsMode({
  children,
  mode,
}: {
  children: React.ReactNode
  mode: 'light' | 'dark'
}) {
  return (
    <div
      className={`ds-mode-${mode} relative flex min-h-36 flex-col content-start items-stretch gap-8 bg-background-default px-6 pb-6 pt-10 text-text-primary ${
        mode === 'dark'
          ? 'border-t border-white/10 lg:border-l lg:border-t-0'
          : ''
      }`}
    >
      <div className="absolute left-6 top-4 font-ds-mono text-ds-mono-caps-xs uppercase text-text-muted">
        {mode}
      </div>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------- Size selector --

   Same treatment as the Iconography page controls: a bordered dropdown trigger
   with a caret, menu items carrying a check on the active option. It lives above
   the light/dark split so one selector drives both panels. */

const TAB_SIZES = [
  { value: 'sm', label: 'Small', px: 32 },
  { value: 'md', label: 'Medium', px: 40 },
  { value: 'lg', label: 'Large', px: 52 },
] as const

const selectorTriggerClass =
  'inline-flex h-10 items-center gap-2 rounded-lg border border-border-default bg-background-surface px-3 text-sm text-text-primary transition-colors hover:bg-background-subtle'

function SizeSelector({
  value,
  onChange,
}: {
  value: SegmentSize
  onChange: (value: SegmentSize) => void
}) {
  const current = TAB_SIZES.find((s) => s.value === value) ?? TAB_SIZES[1]
  return (
    <Dropdown>
      <DropdownTrigger>
        <button type="button" className={selectorTriggerClass}>
          <span>{current.label}</span>
          <span className="tabular-nums text-text-muted">{current.px}px</span>
          <CaretDownIcon size={13} className="text-text-muted" />
        </button>
      </DropdownTrigger>
      <DropdownContent align="start" className="min-w-40">
        {TAB_SIZES.map((s) => (
          <DropdownItem key={s.value} onSelect={() => onChange(s.value)}>
            <span className="flex-1">{s.label}</span>
            <span className="tabular-nums text-text-muted">{s.px}px</span>
            {s.value === value ? (
              <CheckIcon size={14} className="text-text-accent" />
            ) : null}
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  )
}

/** A tab display with a size selector above it, rendered in light + dark. */
function SizedTabsPreview({
  variant,
  ariaLabel,
  options,
  code,
}: {
  variant: 'primary' | 'secondary'
  ariaLabel: string
  options: ReadonlyArray<{ value: string; label: string }>
  code: string
}) {
  const [size, setSize] = React.useState<SegmentSize>('md')
  const demo = (
    <Tabs variant={variant} defaultValue={options[0].value}>
      <TabsList aria-label={ariaLabel} size={size}>
        {options.map((o) => (
          <TabsTrigger key={o.value} value={o.value}>
            {o.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
  return (
    <ComponentPreview code={code} className="block p-0">
      <div className="flex items-center gap-3 border-b border-border-subtle px-6 py-3">
        <span className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-muted">
          Size
        </span>
        <SizeSelector value={size} onChange={setSize} />
      </div>
      <div className="grid w-full lg:grid-cols-2">
        <TabsMode mode="light">{demo}</TabsMode>
        <TabsMode mode="dark">{demo}</TabsMode>
      </div>
    </ComponentPreview>
  )
}

const FRAMEWORKS = [
  { value: 'react', label: 'React' },
  { value: 'solid', label: 'Solid' },
  { value: 'vue', label: 'Vue' },
  { value: 'svelte', label: 'Svelte' },
] as const

const SECTIONS = [
  { value: 'overview', label: 'Overview' },
  { value: 'usage', label: 'Usage' },
  { value: 'api', label: 'API' },
] as const

const LAYOUTS = [
  { value: 'list', label: 'List', icon: <ListIcon weight="bold" /> },
  { value: 'grid', label: 'Grid', icon: <SquaresFourIcon weight="bold" /> },
  { value: 'columns', label: 'Columns', icon: <ColumnsIcon weight="bold" /> },
] as const

function IconOnlyDemo() {
  return (
    <div className="grid w-full lg:grid-cols-2">
      {(['light', 'dark'] as const).map((mode) => (
        <TabsMode key={mode} mode={mode}>
          <Tabs variant="primary" defaultValue="grid">
            <TabsList aria-label="Layout, primary, icon-only">
              {LAYOUTS.map((l) => (
                <TabsTrigger key={l.value} value={l.value} icon={l.icon}>
                  <span className="sr-only">{l.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Tabs variant="secondary" defaultValue="grid">
            <TabsList aria-label="Layout, secondary, icon-only">
              {LAYOUTS.map((l) => (
                <TabsTrigger key={l.value} value={l.value} icon={l.icon}>
                  <span className="sr-only">{l.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </TabsMode>
      ))}
    </div>
  )
}

function TabsPage() {
  return (
    <DsPage
      title="Tabs"
      description="Two styles, one accessible API. `primary` is the prominent underline tab the docs use to switch a page's main content — framework and code tabs. `secondary` is the compact segmented track for switching context inside page content (the same styling backs the SegmentedControl toggle). Both share role=tablist/tab/tabpanel, aria-selected, and roving-tabindex keyboard nav (Arrow / Home / End). Source: src/components/ds/ui/Tabs.tsx."
    >
      <DsSection
        title="Primary"
        description="Underline tabs — prominent and structural. Use them to switch a page's main content (the docs framework/code tabs). Pick a size to preview it."
      >
        <SizedTabsPreview
          variant="primary"
          ariaLabel="Framework"
          options={FRAMEWORKS}
          code={`<Tabs variant="primary" defaultValue="react">
  <TabsList aria-label="Framework" size="md">
    <TabsTrigger value="react">React</TabsTrigger>
    <TabsTrigger value="solid">Solid</TabsTrigger>
    <TabsTrigger value="vue">Vue</TabsTrigger>
  </TabsList>
</Tabs>`}
        />
      </DsSection>

      <DsSection
        title="Secondary"
        description="The segmented track — compact, self-contained tabs for switching context inside page content. Pick a size to preview it."
      >
        <SizedTabsPreview
          variant="secondary"
          ariaLabel="Section"
          options={SECTIONS}
          code={`<Tabs variant="secondary" defaultValue="overview">
  <TabsList aria-label="Section" size="md">
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="usage">Usage</TabsTrigger>
    <TabsTrigger value="api">API</TabsTrigger>
  </TabsList>
</Tabs>`}
        />
      </DsSection>

      <DsSection
        title="Icon only"
        description="Pass just the `icon` and keep an accessible name in an `sr-only` label. Works in both styles."
      >
        <ComponentPreview
          className="block p-0"
          code={`<TabsTrigger value="grid" icon={<SquaresFourIcon />}>
  <span className="sr-only">Grid</span>
</TabsTrigger>`}
        >
          <IconOnlyDemo />
        </ComponentPreview>
      </DsSection>
    </DsPage>
  )
}
