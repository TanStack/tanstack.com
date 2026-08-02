import { EnvelopeSimple } from '@phosphor-icons/react'
import { NewsletterSignup } from '~/components/NewsletterSignup'
import { Footer } from '~/components/Footer'

export function HomeNewsletterSection() {
  return (
    <>
      <section
        aria-labelledby="newsletter"
        className="mx-auto w-full max-w-[96rem] px-6 md:px-10"
      >
        <div className="corner-squircle grid overflow-hidden rounded-2xl border border-border-subtle bg-background-surface px-6 py-8 sm:p-10 lg:mt-[19px] lg:px-[76px] lg:py-[59px]">
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="corner-squircle flex size-12 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-background-subtle text-text-secondary sm:size-14">
              <EnvelopeSimple className="size-6 sm:size-7" weight="light" />
            </div>
            <div className="min-w-0">
              <p className="font-ds-mono text-ds-mono-xs uppercase tracking-wider text-text-muted">
                Newsletter
              </p>
              <h2
                id="newsletter"
                className="mt-2 scroll-mt-24 font-ds-display text-ds-heading-2 font-semibold text-text-primary"
              >
                Subscribe to TanStack News
              </h2>
              <p className="mt-2 max-w-xl text-ds-body-md text-text-secondary">
                New posts, releases, and ecosystem updates from TanStack.
              </p>
            </div>
          </div>

          <NewsletterSignup
            className="mt-8 w-full max-w-[23rem]"
            buttonClassName="min-h-11 corner-squircle rounded-xl border-background-inverse bg-background-inverse px-5 font-ds-display text-ds-body-sm font-semibold text-text-inverse shadow-none hover:bg-background-inverse/90"
            noteClassName="font-ds-mono text-[11px] tracking-wide text-text-muted"
            successClassName="text-ds-body-sm text-text-success"
          />
        </div>
      </section>
      <div className="h-16 sm:h-20" />
      <Footer />
    </>
  )
}
