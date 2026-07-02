import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  Download,
  Plus,
  MagnifyingGlass,
  Gear,
  Trash,
} from '@phosphor-icons/react'
import { seo } from '~/utils/seo'
import { Button } from '~/components/ds/ui'
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

function ButtonsPage() {
  return (
    <DsPage
      title="Buttons"
      description="A polymorphic button (render as a link or any element via `as`). Composed from variant + color + size + rounded. Source: src/ui/Button.tsx."
    >
      <DsSection
        title="Variants"
        description="primary, secondary, ghost, link, and icon."
      >
        <ComponentPreview
          code={`<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
<Button variant="icon" aria-label="Add"><Plus /></Button>`}
        >
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="icon" aria-label="Add">
            <Plus className="h-4 w-4" />
          </Button>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Colors"
        description="Primary variant across the full color set."
      >
        <ComponentPreview
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
        </ComponentPreview>
      </DsSection>

      <DsSection title="Sizes" description="xs, sm, md (default), lg.">
        <ComponentPreview
          code={`<Button size="xs">Extra small</Button>
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>`}
        >
          <Button size="xs">Extra small</Button>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Link buttons"
        description="The link variant reads as an inline text link — for low-emphasis actions and inline navigation. Takes any color and size."
      >
        <ComponentPreview
          code={`<Button variant="link">Documentation</Button>
<Button variant="link" color="gray">Learn more</Button>
<Button variant="link">Read the guide <ArrowRight /></Button>`}
        >
          <Button variant="link">Documentation</Button>
          <Button variant="link" color="gray">
            Learn more
          </Button>
          <Button variant="link">
            Read the guide <ArrowRight className="h-4 w-4" />
          </Button>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Icon buttons"
        description="Icon-only buttons via the icon variant, in both icon sizes (icon-sm, icon-md) and any color."
      >
        <ComponentPreview
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
        </ComponentPreview>
      </DsSection>

      <DsSection title="Rounded" description="none, md, lg, full.">
        <ComponentPreview
          code={`<Button rounded="none">None</Button>
<Button rounded="md">Medium</Button>
<Button rounded="lg">Large</Button>
<Button rounded="full">Full</Button>`}
        >
          <Button rounded="none">None</Button>
          <Button rounded="md">Medium</Button>
          <Button rounded="lg">Large</Button>
          <Button rounded="full">Full</Button>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="With icons & states"
        description="Buttons accept any children, and forward native props like disabled."
      >
        <ComponentPreview
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
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Button group"
        description="Segmented buttons via ButtonGroup. Source: src/components/ButtonGroup.tsx."
      >
        <ComponentPreview
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
        </ComponentPreview>
      </DsSection>
    </DsPage>
  )
}
