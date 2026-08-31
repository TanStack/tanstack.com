import { createFileRoute } from '@tanstack/react-router'
import {
  CaretDownIcon,
  SignOutIcon,
  GearIcon,
  UserIcon,
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
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/dropdown')({
  component: DropdownPage,
  head: () => ({
    meta: seo({
      title: 'Dropdown | TanStack Design System',
      description: 'The Radix-powered Dropdown menu.',
    }),
  }),
})

const SCROLL_ITEMS = [
  'Start',
  'Router',
  'Query',
  'Table',
  'Form',
  'Store',
  'DB',
  'AI',
  'Virtual',
  'Pacer',
  'Ranger',
  'Devtools',
  'Config',
  'CLI',
  'Intent',
  'Highlight',
  'Markdown',
]

function DropdownPage() {
  return (
    <DsPage
      title="Dropdown"
      description="A menu built on Radix primitives, composed from Dropdown + Trigger + Content + Item + Separator. Source: src/components/Dropdown.tsx."
    >
      <DsSection
        title="Basic menu"
        description="Click the trigger to open. Content is portaled and keyboard-navigable."
      >
        <ComponentPreview
          code={`<Dropdown>
  <DropdownTrigger>
    <Button variant="secondary">Account <CaretDownIcon /></Button>
  </DropdownTrigger>
  <DropdownContent align="start">
    <DropdownItem><UserIcon /> Profile</DropdownItem>
    <DropdownItem><GearIcon /> Settings</DropdownItem>
    <DropdownSeparator />
    <DropdownItem><SignOutIcon /> Sign out</DropdownItem>
  </DropdownContent>
</Dropdown>`}
        >
          <Dropdown>
            <DropdownTrigger>
              <Button variant="secondary">
                Account <CaretDownIcon className="h-4 w-4" />
              </Button>
            </DropdownTrigger>
            <DropdownContent align="start">
              <DropdownItem>
                <UserIcon className="h-4 w-4" /> Profile
              </DropdownItem>
              <DropdownItem>
                <GearIcon className="h-4 w-4" /> Settings
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem>
                <SignOutIcon className="h-4 w-4" /> Sign out
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Scrollable"
        description="Pass `maxHeight` to cap a long menu. Overflow reveals a thin, low-opacity scrollbar meant to read only as a 'more content' indicator — not a grab target."
      >
        <ComponentPreview
          code={`<DropdownContent align="start" maxHeight="14rem">
  {items.map((label) => (
    <DropdownItem key={label}>{label}</DropdownItem>
  ))}
</DropdownContent>`}
        >
          <Dropdown>
            <DropdownTrigger>
              <Button variant="secondary">
                Pick a library <CaretDownIcon className="h-4 w-4" />
              </Button>
            </DropdownTrigger>
            <DropdownContent align="start" maxHeight="14rem">
              {SCROLL_ITEMS.map((label) => (
                <DropdownItem key={label}>{label}</DropdownItem>
              ))}
            </DropdownContent>
          </Dropdown>
        </ComponentPreview>
      </DsSection>
    </DsPage>
  )
}
