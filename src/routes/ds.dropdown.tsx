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
      description: 'The Base UI-powered Dropdown menu.',
    }),
  }),
})

function DropdownPage() {
  return (
    <DsPage
      title="Dropdown"
      description="A menu built on Base UI primitives, composed from Dropdown + Trigger + Content + Item + Separator. Source: src/components/Dropdown.tsx."
    >
      <DsSection
        title="Basic menu"
        description="Click the trigger to open. Content is portaled and keyboard-navigable."
      >
        <ComponentPreview
          code={`<Dropdown>
  <DropdownTrigger
    render={<Button variant="secondary">Account <CaretDownIcon /></Button>}
  />
  <DropdownContent align="start">
    <DropdownItem><UserIcon /> Profile</DropdownItem>
    <DropdownItem><GearIcon /> Settings</DropdownItem>
    <DropdownSeparator />
    <DropdownItem><SignOutIcon /> Sign out</DropdownItem>
  </DropdownContent>
</Dropdown>`}
        >
          <Dropdown>
            <DropdownTrigger
              render={
                <Button variant="secondary">
                  Account <CaretDownIcon className="h-4 w-4" />
                </Button>
              }
            />
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
    </DsPage>
  )
}
