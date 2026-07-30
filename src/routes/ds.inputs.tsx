import { createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { FormInput } from '~/components/ds/ui'
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/inputs')({
  component: InputsPage,
  head: () => ({
    meta: seo({
      title: 'Inputs | TanStack Design System',
      description: 'The FormInput component — text fields and focus rings.',
    }),
  }),
})

function InputsPage() {
  return (
    <DsPage
      title="Inputs"
      description="Text inputs with consistent borders, dark-mode surfaces, and a configurable focus ring. Source: src/ui/FormInput.tsx."
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
        title="Focus rings"
        description="Focus a field to see its ring. Choose blue (default), orange, or purple."
      >
        <ComponentPreview
          className="block max-w-sm space-y-3"
          code={`<FormInput focusRing="blue" placeholder="Blue ring (default)" />
<FormInput focusRing="orange" placeholder="Orange ring" />
<FormInput focusRing="purple" placeholder="Purple ring" />`}
        >
          <FormInput focusRing="blue" placeholder="Blue ring (default)" />
          <FormInput focusRing="orange" placeholder="Orange ring" />
          <FormInput focusRing="purple" placeholder="Purple ring" />
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
    </DsPage>
  )
}
