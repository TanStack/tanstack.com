import { createFileRoute } from '@tanstack/react-router'
import { CaretDown, SignOut, Gear, User } from '@phosphor-icons/react'
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
    <Button variant="secondary">Account <CaretDown /></Button>
  </DropdownTrigger>
  <DropdownContent align="start">
    <DropdownItem><User /> Profile</DropdownItem>
    <DropdownItem><Gear /> Settings</DropdownItem>
    <DropdownSeparator />
    <DropdownItem><SignOut /> Sign out</DropdownItem>
  </DropdownContent>
</Dropdown>`}
        >
          <Dropdown>
            <DropdownTrigger>
              <Button variant="secondary">
                Account <CaretDown className="h-4 w-4" />
              </Button>
            </DropdownTrigger>
            <DropdownContent align="start">
              <DropdownItem>
                <User className="h-4 w-4" /> Profile
              </DropdownItem>
              <DropdownItem>
                <Gear className="h-4 w-4" /> Settings
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem>
                <SignOut className="h-4 w-4" /> Sign out
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </ComponentPreview>
      </DsSection>
    </DsPage>
  )
}
