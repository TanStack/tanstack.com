import { NewsletterSignup } from '~/components/NewsletterSignup'

export function HomeNewsletterSection() {
  return (
    <>
      <section
        aria-labelledby="newsletter"
        className="mx-auto w-full max-w-[96rem] px-6 md:px-10"
      >
        <div className="corner-squircle relative isolate overflow-hidden rounded-2xl border border-border-subtle px-6 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-12">
          {/* Barely-there surface, a soft light from the top-left corner, and a
              hairline that catches it along the top edge. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-background-surface/40"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-48 -left-32 -z-10 size-[34rem] rounded-full bg-[radial-gradient(closest-side,currentColor,transparent)] text-text-primary opacity-[0.045]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-linear-to-r from-border-strong/70 via-border-default/40 to-transparent"
          />

          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-16">
            <div className="min-w-0">
              <h2
                id="newsletter"
                className="scroll-mt-24 text-balance font-ds-display text-ds-heading-2 text-text-primary"
              >
                Subscribe to TanStack News
              </h2>
              <p className="mt-3 max-w-xl text-pretty font-ds-mono text-ds-mono-sm text-text-secondary">
                New posts, releases, and ecosystem updates from TanStack.
              </p>
            </div>

            <NewsletterSignup
              appearance="ds"
              label="Subscribe"
              showIcon={false}
              showNote={false}
              className="w-full sm:w-auto"
              buttonClassName="sm:w-auto"
              successClassName="text-ds-body-sm text-text-success"
            />
          </div>
        </div>
      </section>
      <div className="h-24 md:h-32" />
    </>
  )
}
