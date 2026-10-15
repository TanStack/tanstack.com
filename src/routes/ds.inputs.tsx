import { createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { FormInput, SearchInput } from '~/components/ds/ui'
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/inputs')({
  component: InputsPage,
  head: () => ({
    meta: seo({
      title: 'Inputs | TanStack Design System',
      description:
        'The FormInput component — text fields with a neutral focus.',
    }),
  }),
})

function InputsPage() {
  return (
    <DsPage
      title="Inputs"
      description="Text inputs with consistent borders and dark-mode surfaces. Focus is a single neutral border-color change — no ring. Source: src/ui/FormInput.tsx."
    >
      <DsSection
        title="Default"
        description="Forwards all native input props (type, value, placeholder, etc.)."
      >
        <ComponentPreview
          className="block max-w-sm"
          code={`<FormInput placeholder="you@example.com" type="email" />`}
        >
          <FormInput placeholder="you@example.com" type="email" />
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Focus"
        description="Focus is a single neutral border-color change — the border lifts to the strong neutral token, with no ring or accent."
      >
        <ComponentPreview
          className="block max-w-sm"
          code={`<FormInput placeholder="Focus me" />`}
        >
          <FormInput placeholder="Focus me" />
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="With a label & disabled"
        description="Compose with a label element; supports the native disabled state."
      >
        <ComponentPreview
          className="block max-w-sm space-y-4"
          code={`<label htmlFor="project-name" className="block space-y-1.5">
  <span className="text-sm font-medium">Project name</span>
  <FormInput id="project-name" placeholder="my-app" />
</label>
<FormInput disabled value="Disabled" readOnly />`}
        >
          <label htmlFor="project-name" className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Project name
            </span>
            <FormInput id="project-name" placeholder="my-app" />
          </label>
          <FormInput disabled value="Disabled" readOnly />
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Progressive search"
        description="Starts as a compact search action. Activating it reveals the field from the icon and moves focus directly into the input. Escape closes it."
      >
        <ComponentPreview
          className="block min-h-24"
          code={`<SearchInput progressive placeholder="Search documentation…" />`}
        >
          <SearchInput progressive placeholder="Search documentation…" />
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Persistent search"
        description="Use when search is a primary task and should remain visible."
      >
        <ComponentPreview
          className="block max-w-md"
          code={`<SearchInput placeholder="Search documentation…" />`}
        >
          <SearchInput placeholder="Search documentation…" />
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Large search target"
        description="A larger, highly visible target for prominent search experiences and touch-heavy layouts."
      >
        <ComponentPreview
          className="block max-w-xl"
          code={`<SearchInput size="large" placeholder="What are you looking for?" />`}
        >
          <SearchInput size="large" placeholder="What are you looking for?" />
        </ComponentPreview>
      </DsSection>
    </DsPage>
  )
}
