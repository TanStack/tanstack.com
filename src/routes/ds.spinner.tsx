import { createFileRoute } from "@tanstack/react-router";
import { seo } from "~/utils/seo";
import { PixelSpinner, Spinner } from "~/components/ds/ui";
import { ComponentPreview, DsPage, DsSection } from "~/components/ds/DsKit";

export const Route = createFileRoute("/ds/spinner")({
  component: SpinnerPage,
  head: () => ({
    meta: seo({
      title: "Spinner | TanStack Design System",
      description: "The Spinner loading indicator.",
    }),
  }),
});

function SpinnerPage() {
  return (
    <DsPage
      title="Spinners"
      description="A collection of TanStack spinners produced by us for the community."
    >
      <DsSection
        title="Spinner"
        description={
          <>
            A simple animated loading indicator. Size it with w-/h- utilities
            and recolor it with text-* (it inherits currentColor).
            <br />
            Source:{" "}
            <a
              href="https://github.com/TanStack/tanstack.com/blob/main/src/components/Spinner.tsx"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-text-primary"
            >
              src/components/Spinner.tsx
            </a>
            .
          </>
        }
      >
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
        title="Headbanger"
        description={
          <>
            A branded pixel-art loader — a 12-frame sprite animation on a
            canvas. Multi-color by design (it does not inherit currentColor);
            size it with w-/h- utilities. Holds on the first frame when
            prefers-reduced-motion is set.
            <br />
            Source:{" "}
            <a
              href="https://github.com/TanStack/tanstack.com/blob/main/src/components/ds/ui/PixelSpinner.tsx"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-text-primary"
            >
              src/components/ds/ui/PixelSpinner.tsx
            </a>
            .
          </>
        }
      >
        <ComponentPreview
          code={`<PixelSpinner className="w-8 h-8" />
<PixelSpinner className="w-12 h-12" />
<PixelSpinner className="w-16 h-16" />`}
        >
          <PixelSpinner className="h-8 w-8" />
          <PixelSpinner className="h-12 w-12" />
          <PixelSpinner className="h-16 w-16" />
        </ComponentPreview>
      </DsSection>
    </DsPage>
  );
}
