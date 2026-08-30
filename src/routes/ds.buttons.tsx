import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowRightIcon,
  CaretDownIcon,
  CheckIcon,
  DownloadIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  GearIcon,
  TrashIcon,
  PlayIcon,
} from '@phosphor-icons/react'
import { seo } from '~/utils/seo'
import {
  Button,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
} from '~/components/ds/ui'
import { ButtonGroup } from '~/components/ButtonGroup'
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/buttons')({
  component: ButtonsPage,
  head: () => ({
    meta: seo({
      title: 'Buttons | TanStack Design System',
      description: 'The polymorphic Button — variants, colors, sizes, states.',
    }),
  }),
})

const COLORS = [
  'blue',
  'green',
  'red',
  'orange',
  'purple',
  'gray',
  'emerald',
  'cyan',
  'yellow',
] as const

function ButtonPreview({
  children,
  code,
}: {
  children: React.ReactNode
  code: string
}) {
  return (
    <ComponentPreview code={code} className="block p-0">
      <div className="grid w-full lg:grid-cols-2">
        <ButtonMode mode="light">{children}</ButtonMode>
        <ButtonMode mode="dark">{children}</ButtonMode>
      </div>
    </ComponentPreview>
  )
}

function ButtonMode({
  children,
  mode,
}: {
  children: React.ReactNode
  mode: 'light' | 'dark'
}) {
  return (
    <div
      className={`ds-mode-${mode} relative flex min-h-36 flex-wrap content-center items-center gap-4 bg-background-default px-6 pb-6 pt-10 text-text-primary lg:min-h-40 ${
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

function Toolbar() {
  const [showFiles, setShowFiles] = React.useState(true)
  const [showConsole, setShowConsole] = React.useState(false)

  return (
    <ButtonGroup aria-label="Editor actions">
      <Button
        variant="ghost"
        size="xs"
        rounded="none"
        aria-pressed={showFiles}
        onClick={() => setShowFiles((v) => !v)}
      >
        Files
      </Button>
      <Button
        variant="ghost"
        size="xs"
        rounded="none"
        aria-pressed={showConsole}
        onClick={() => setShowConsole((v) => !v)}
      >
        Console
      </Button>
      <Button variant="primary" size="xs" rounded="none">
        <PlayIcon className="h-3.5 w-3.5" weight="fill" /> Run
      </Button>
    </ButtonGroup>
  )
}

function ButtonsPage() {
  return (
    <DsPage
      title="Buttons"
      description="A polymorphic button (render as a link or any element via `as`). Composed from variant + color + size + rounded. Below the 900px mobile breakpoint, buttons use their brighter hover treatment as the resting state so touch interfaces retain the same visual affordance. Source: src/components/ds/ui/index.tsx."
    >
      <DsSection
        title="Variants"
        description="primary, secondary, ghost, link, subtle-link, and icon."
      >
        <ButtonPreview
          code={`<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
<Button variant="subtle-link">Subtle link <ArrowRightIcon /></Button>
<Button variant="icon" aria-label="Add"><PlusIcon /></Button>`}
        >
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="subtle-link" color="gray">
            Subtle link <ArrowRightIcon />
          </Button>
          <Button variant="icon" aria-label="Add">
            <PlusIcon className="h-4 w-4" />
          </Button>
        </ButtonPreview>
      </DsSection>

      <DsSection
        title="Gradient (landing CTA)"
        description="The library-landing primary call-to-action, promoted to a Button variant so the styling lives here: an accent→bright gradient with an inner highlight, a colored glow, ink text, and a hover lift. Colors map to the category accents (src/styles/app.css)."
      >
        <ButtonPreview
          code={`<Button variant="gradient" color="green">Get started</Button>
<Button variant="gradient" color="red">Get started</Button>
<Button variant="gradient" color="blue">Get started</Button>
<Button variant="gradient" color="orange">Get started</Button>
<Button variant="gradient" color="purple">Get started</Button>
<Button variant="gradient">Copy prompt <ArrowRightIcon /></Button>`}
        >
          <Button variant="gradient" color="green">
            Get started
          </Button>
          <Button variant="gradient" color="red">
            Get started
          </Button>
          <Button variant="gradient" color="blue">
            Get started
          </Button>
          <Button variant="gradient" color="orange">
            Get started
          </Button>
          <Button variant="gradient" color="purple">
            Get started
          </Button>
          <Button variant="gradient">
            Copy prompt <ArrowRightIcon className="h-4 w-4" />
          </Button>
        </ButtonPreview>
      </DsSection>

      <DsSection
        title="Colors"
        description="Primary variant across the full color set."
        className="space-y-0"
      >
        <ButtonPreview
          code={`<Button color="blue">Blue</Button>
<Button color="green">Green</Button>
<Button color="red">Red</Button>
{/* …orange, purple, gray, emerald, cyan, yellow */}`}
        >
          {COLORS.map((color) => (
            <Button key={color} color={color}>
              {color[0].toUpperCase() + color.slice(1)}
            </Button>
          ))}
        </ButtonPreview>
      </DsSection>

      <DsSection title="Sizes" description="xs, sm, md (default), lg.">
        <ButtonPreview
          code={`<Button size="xs">Extra small</Button>
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>`}
        >
          <Button size="xs">Extra small</Button>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </ButtonPreview>
      </DsSection>

      <DsSection
        title="Link buttons"
        description="Link is an inline text action. Subtle link is the canonical low-emphasis navigation action used by mega menus and section footers; it owns its mono label, spacing, muted color, and trailing-icon motion here."
      >
        <ButtonPreview
          code={`<Button variant="link">Documentation</Button>
<Button variant="link" color="gray">Learn more</Button>
<Button variant="subtle-link" color="gray">View all posts <ArrowRightIcon /></Button>`}
        >
          <Button variant="link">Documentation</Button>
          <Button variant="link" color="gray">
            Learn more
          </Button>
          <Button variant="subtle-link" color="gray">
            View all posts <ArrowRightIcon />
          </Button>
        </ButtonPreview>
      </DsSection>

      <DsSection
        title="Icon buttons"
        description="Icon-only buttons via the icon variant, in both icon sizes (icon-sm, icon-md) and any color."
      >
        <ButtonPreview
          code={`<Button variant="icon" size="icon-sm" aria-label="Search"><MagnifyingGlassIcon /></Button>
<Button variant="icon" size="icon-md" aria-label="Settings"><GearIcon /></Button>
<Button variant="icon" color="red" aria-label="Delete"><TrashIcon /></Button>`}
        >
          <Button variant="icon" size="icon-sm" aria-label="Search">
            <MagnifyingGlassIcon className="h-4 w-4" />
          </Button>
          <Button variant="icon" size="icon-md" aria-label="Settings">
            <GearIcon className="h-5 w-5" />
          </Button>
          <Button variant="icon" size="icon-md" color="green" aria-label="Add">
            <PlusIcon className="h-5 w-5" />
          </Button>
          <Button variant="icon" color="red" aria-label="Delete">
            <TrashIcon className="h-5 w-5" />
          </Button>
        </ButtonPreview>
      </DsSection>

      <DsSection title="Rounded" description="none, md, lg, full.">
        <ButtonPreview
          code={`<Button rounded="none">None</Button>
<Button rounded="md">Medium</Button>
<Button rounded="lg">Large</Button>
<Button rounded="full">Full</Button>`}
        >
          <Button rounded="none">None</Button>
          <Button rounded="md">Medium</Button>
          <Button rounded="lg">Large</Button>
          <Button rounded="full">Full</Button>
        </ButtonPreview>
      </DsSection>

      <DsSection
        title="With icons & states"
        description="Buttons accept any children, and forward native props like disabled."
      >
        <ButtonPreview
          code={`<Button><DownloadIcon /> Download</Button>
<Button variant="ghost" color="red"><TrashIcon /> Delete</Button>
<Button disabled>Disabled</Button>`}
        >
          <Button>
            <DownloadIcon className="h-4 w-4" /> Download
          </Button>
          <Button variant="ghost" color="red">
            <TrashIcon className="h-4 w-4" /> Delete
          </Button>
          <Button disabled>Disabled</Button>
        </ButtonPreview>
      </DsSection>

      <DsSection
        title="Button group"
        description="The low-level toolbar primitive: bring your own buttons and ButtonGroup joins them with shared edges and one outer border. Reach for it when the group is heterogeneous — mixed toggles plus a primary action or a dropdown trigger. For a single-select control, prefer the SegmentedControl (see the Segmented control page). Source: src/components/ButtonGroup.tsx."
      >
        <ButtonPreview
          code={`<ButtonGroup aria-label="Editor actions">
  <Button variant="ghost" rounded="none" aria-pressed={showFiles}>Files</Button>
  <Button variant="ghost" rounded="none" aria-pressed={showConsole}>Console</Button>
  <Button variant="primary" rounded="none"><PlayIcon /> Run</Button>
</ButtonGroup>`}
        >
          <Toolbar />
        </ButtonPreview>
      </DsSection>

      <DsSection
        title="Leading & trailing icons"
        description="Icons sit inline with the label (baseStyles gap-2). Lead with an icon to reinforce the action, or trail one for direction, disclosure, or download — across any variant and color."
      >
        <ButtonPreview
          code={`{/* leading */}
<Button><PlusIcon /> New project</Button>
<Button variant="secondary"><GearIcon /> Settings</Button>
<Button variant="ghost" color="red"><TrashIcon /> Delete</Button>
{/* trailing */}
<Button>Continue <ArrowRightIcon /></Button>
<Button variant="secondary">Export <DownloadIcon /></Button>
<Button variant="ghost">Options <CaretDownIcon /></Button>
<Button color="green">Save <CheckIcon /></Button>`}
        >
          <Button>
            <PlusIcon className="h-4 w-4" /> New project
          </Button>
          <Button variant="secondary">
            <GearIcon className="h-4 w-4" /> Settings
          </Button>
          <Button variant="ghost" color="red">
            <TrashIcon className="h-4 w-4" /> Delete
          </Button>
          <Button>
            Continue <ArrowRightIcon className="h-4 w-4" />
          </Button>
          <Button variant="secondary">
            Export <DownloadIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost">
            Options <CaretDownIcon className="h-4 w-4" />
          </Button>
          <Button color="green">
            Save <CheckIcon className="h-4 w-4" />
          </Button>
        </ButtonPreview>
      </DsSection>

      <DsSection
        title="Split button"
        description="A primary action paired with a dropdown selector for related choices. Click the caret to open the menu. Composed from Button + the Dropdown primitives."
      >
        <ButtonPreview
          code={`<div className="inline-flex overflow-hidden rounded-lg">
  <Button rounded="none">Deploy</Button>
  <Dropdown>
    <DropdownTrigger
      render={
        <Button rounded="none" aria-label="More deploy options" className="border-l border-white/20 px-2">
          <CaretDownIcon />
        </Button>
      }
    />
    <DropdownContent align="end">
      <DropdownItem>Deploy to production</DropdownItem>
      <DropdownItem>Deploy a preview</DropdownItem>
      <DropdownSeparator />
      <DropdownItem>Configure…</DropdownItem>
    </DropdownContent>
  </Dropdown>
</div>`}
        >
          <div className="inline-flex overflow-hidden rounded-lg">
            <Button rounded="none">Deploy</Button>
            <Dropdown>
              <DropdownTrigger
                render={
                  <Button
                    rounded="none"
                    aria-label="More deploy options"
                    className="border-l border-white/20 px-2"
                  >
                    <CaretDownIcon className="h-4 w-4" />
                  </Button>
                }
              />
              <DropdownContent align="end">
                <DropdownItem>Deploy to production</DropdownItem>
                <DropdownItem>Deploy a preview</DropdownItem>
                <DropdownSeparator />
                <DropdownItem>Configure…</DropdownItem>
              </DropdownContent>
            </Dropdown>
          </div>
        </ButtonPreview>
      </DsSection>
    </DsPage>
  )
}
