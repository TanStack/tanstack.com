import { createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { PalmSpinner, Spinner } from '~/components/ds/ui'
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/spinner')({
  component: SpinnerPage,
  head: () => ({
    meta: seo({
      title: 'Spinner | TanStack Design System',
      description: 'The Spinner loading indicator.',
    }),
  }),
})

function SpinnerPage() {
  return (
    <DsPage
      title="Spinner"
      description="A simple animated loading indicator. Size it with w-/h- utilities and recolor it with text-* (it inherits currentColor). Source: src/components/Spinner.tsx."
    >
      <DsSection title="Sizes & color">
        <ComponentPreview
          code={`<Spinner className="w-4 h-4" />
<Spinner />
<Spinner className="w-8 h-8" />
<Spinner className="w-8 h-8 text-blue-500" />`}
        >
          <Spinner className="h-4 w-4" />
          <Spinner />
          <Spinner className="h-8 w-8" />
          <Spinner className="h-8 w-8 text-blue-500" />
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Palm spinner"
        description="A branded, pixel-art palm that sways like a palm in the wind. Intentionally multi-color (does not inherit currentColor). Size it with w-/h- utilities. Source: src/components/ds/ui/PalmSpinner.tsx."
      >
        <ComponentPreview
          code={`<PalmSpinner className="w-8 h-8" />
<PalmSpinner className="w-12 h-12" />
<PalmSpinner className="w-16 h-16" />`}
        >
          <PalmSpinner className="h-8 w-8" />
          <PalmSpinner className="h-12 w-12" />
          <PalmSpinner className="h-16 w-16" />
        </ComponentPreview>
      </DsSection>
    </DsPage>
  )
}
