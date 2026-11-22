import { EnvelopeSimpleIcon } from '@phosphor-icons/react'
import { NewsletterSignup } from '~/components/NewsletterSignup'

export function HomeNewsletterSection() {
  return (
    <>
      <section
        aria-labelledby="newsletter"
        className="mx-auto w-full px-4 lg:max-w-(--breakpoint-lg)"
      >
        <div className="corner-squircle grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 overflow-hidden rounded-2xl border border-border-subtle bg-background-surface px-6 py-8 sm:gap-x-8 sm:p-10 lg:mt-[19px] lg:py-[59px]">
          <h2
            id="newsletter"
            className="scroll-mt-24 font-ds-display text-ds-heading-2 font-semibold text-text-primary sm:self-end"
          >
            Subscribe to TanStack News
          </h2>
          <div
            aria-hidden="true"
            className="corner-squircle col-start-2 row-start-1 flex size-8 items-center justify-center rounded-lg border border-border-subtle bg-background-subtle text-text-secondary sm:row-end-3 sm:size-32 sm:rounded-2xl lg:size-40"
          >
            <EnvelopeSimpleIcon
              className="size-5 sm:size-16 lg:size-20"
              weight="light"
            />
          </div>
          <div className="col-span-2 sm:col-span-1 sm:self-start">
            <p className="mt-2 max-w-xl text-ds-body-md text-text-secondary">
              New posts, releases, and ecosystem updates from TanStack.
            </p>

            <NewsletterSignup
              className="mt-8 w-full max-w-[23rem]"
              buttonClassName="min-h-11 corner-squircle rounded-xl border-background-inverse bg-background-inverse px-5 font-ds-display text-ds-body-sm font-semibold text-text-inverse shadow-none hover:bg-background-inverse/90"
              successClassName="text-ds-body-sm text-text-success"
              showNote={false}
            />
          </div>
        </div>
      </section>
      <div className="h-16 sm:h-20" />
    </>
  )
}
