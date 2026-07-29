import type * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  CaretDown,
  Check,
  Download,
  Plus,
  MagnifyingGlass,
  Gear,
  Trash,
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
<Button variant="subtle-link">Subtle link <ArrowRight /></Button>
<Button variant="icon" aria-label="Add"><Plus /></Button>`}
        >
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="subtle-link" color="gray">
            Subtle link <ArrowRight />
          </Button>
          <Button variant="icon" aria-label="Add">
            <Plus className="h-4 w-4" />
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
<Button variant="gradient">Copy prompt <ArrowRight /></Button>`}
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
            Copy prompt <ArrowRight className="h-4 w-4" />
          </Button>
        </ButtonPreview>
      </DsSection>

      <DsSection
        title="Colors"
        description="Primary variant across the full color set."
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
<Button variant="subtle-link" color="gray">View all posts <ArrowRight /></Button>`}
        >
          <Button variant="link">Documentation</Button>
          <Button variant="link" color="gray">
            Learn more
          </Button>
          <Button variant="subtle-link" color="gray">
            View all posts <ArrowRight />
          </Button>
        </ButtonPreview>
      </DsSection>

      <DsSection
        title="Icon buttons"
        description="Icon-only buttons via the icon variant, in both icon sizes (icon-sm, icon-md) and any color."
      >
        <ButtonPreview
          code={`<Button variant="icon" size="icon-sm" aria-label="Search"><MagnifyingGlass /></Button>
<Button variant="icon" size="icon-md" aria-label="Settings"><Gear /></Button>
<Button variant="icon" color="red" aria-label="Delete"><Trash /></Button>`}
        >
          <Button variant="icon" size="icon-sm" aria-label="Search">
            <MagnifyingGlass className="h-4 w-4" />
          </Button>
          <Button variant="icon" size="icon-md" aria-label="Settings">
            <Gear className="h-5 w-5" />
          </Button>
          <Button variant="icon" size="icon-md" color="green" aria-label="Add">
            <Plus className="h-5 w-5" />
          </Button>
          <Button variant="icon" color="red" aria-label="Delete">
            <Trash className="h-5 w-5" />
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
          code={`<Button><Download /> Download</Button>
<Button variant="ghost" color="red"><Trash /> Delete</Button>
<Button disabled>Disabled</Button>`}
        >
          <Button>
            <Download className="h-4 w-4" /> Download
          </Button>
          <Button variant="ghost" color="red">
            <Trash className="h-4 w-4" /> Delete
          </Button>
          <Button disabled>Disabled</Button>
        </ButtonPreview>
      </DsSection>

      <DsSection
        title="Button group"
        description="Segmented buttons via ButtonGroup. Source: src/components/ButtonGroup.tsx."
      >
        <ButtonPreview
          code={`<ButtonGroup>
  <Button variant="ghost" rounded="none">Day</Button>
  <Button variant="ghost" rounded="none">Week</Button>
  <Button variant="ghost" rounded="none">Month</Button>
</ButtonGroup>`}
        >
          <ButtonGroup>
            <Button variant="ghost" rounded="none">
              Day
            </Button>
            <Button variant="ghost" rounded="none">
              Week
            </Button>
            <Button variant="ghost" rounded="none">
              Month
            </Button>
          </ButtonGroup>
        </ButtonPreview>
      </DsSection>

      <DsSection
        title="Leading & trailing icons"
        description="Icons sit inline with the label (baseStyles gap-2). Lead with an icon to reinforce the action, or trail one for direction, disclosure, or download — across any variant and color."
      >
        <ButtonPreview
          code={`{/* leading */}
<Button><Plus /> New project</Button>
<Button variant="secondary"><Gear /> Settings</Button>
<Button variant="ghost" color="red"><Trash /> Delete</Button>
{/* trailing */}
<Button>Continue <ArrowRight /></Button>
<Button variant="secondary">Export <Download /></Button>
<Button variant="ghost">Options <CaretDown /></Button>
<Button color="green">Save <Check /></Button>`}
        >
          <Button>
            <Plus className="h-4 w-4" /> New project
          </Button>
          <Button variant="secondary">
            <Gear className="h-4 w-4" /> Settings
          </Button>
          <Button variant="ghost" color="red">
            <Trash className="h-4 w-4" /> Delete
          </Button>
          <Button>
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="secondary">
            Export <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost">
            Options <CaretDown className="h-4 w-4" />
          </Button>
          <Button color="green">
            Save <Check className="h-4 w-4" />
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
    <DropdownTrigger>
      <Button rounded="none" aria-label="More deploy options" className="border-l border-white/20 px-2">
        <CaretDown />
      </Button>
    </DropdownTrigger>
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
              <DropdownTrigger>
                <Button
                  rounded="none"
                  aria-label="More deploy options"
                  className="border-l border-white/20 px-2"
                >
                  <CaretDown className="h-4 w-4" />
                </Button>
              </DropdownTrigger>
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
