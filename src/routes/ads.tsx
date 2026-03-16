import { Link, createFileRoute } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { seo } from '~/utils/seo'
import { authClient } from '~/utils/auth.client'
import { Authenticated, Unauthenticated } from '~/components/AuthComponents'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { useToast } from '~/components/ToastProvider'
import { useEffect, useState } from 'react'
import { setInterestedInHidingAds } from '~/utils/users.server'
import { GithubIcon } from '~/components/icons/GithubIcon'
import { CheckCircleIcon } from '~/components/icons/CheckCircleIcon'
import { GoogleIcon } from '~/components/icons/GoogleIcon'

export const Route = createFileRoute('/ads')({
  component: RouteComp,
  head: () => ({
    meta: seo({
      title: 'Ads & Partnerships | TanStack',
      description:
        'How TanStack approaches ads and partnerships to sustain open source development.',
    }),
  }),
})

function RouteComp() {
  return (
    <div className="flex flex-col max-w-full min-h-screen gap-12 p-4 md:p-8 pb-0">
      <div className="flex-1 space-y-12 w-full max-w-3xl mx-auto">
        <header>
          <h1 className="text-3xl font-black">Ads & Partnerships</h1>
        </header>

        <section
          id="tldr"
          className="space-y-4 p-6 bg-gray-100 dark:bg-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-700 scroll-mt-8"
        >
          <h2 className="text-xl font-semibold">
            <Link to="/ads" hash="tldr" className="hover:underline">
              Quick Summary
            </Link>
          </h2>
          <p className="text-lg font-medium">
            TanStack libraries are{' '}
            <strong>
              <em>forever free</em>
            </strong>{' '}
            for everyone, including companies, without any hidden cost, agenda,
            paid upsells, or licensing shenanigans. We've removed third-party
            ads from the site to give you a faster, cleaner experience.
          </p>
        </section>

        <section className="space-y-4">
          <p>
            TanStack is <strong>independently operated</strong> with no paid
            products and no venture capital. We're a small, focused team
            dedicated to creating open source software used by millions of
            developers daily.
          </p>
          <p>
            We previously used third-party programmatic ads to help fund
            development. While they served us well, they came with trade-offs:
            heavy scripts, slow page loads, and a cluttered experience. We've
            decided to move in a different direction.
          </p>
        </section>

        <section id="whats-changed" className="space-y-4 scroll-mt-8">
          <h2 className="text-2xl font-semibold">
            <Link to="/ads" hash="whats-changed" className="hover:underline">
              What's Changed
            </Link>
          </h2>
          <ul className="list-disc pl-8 space-y-2">
            <li>
              <strong>No more third-party ads.</strong> We've completely removed
              all external ad networks and their associated scripts from the
              site.
            </li>
            <li>
              <strong>Faster pages.</strong> Without heavy ad SDKs and chained
              dependencies, every page loads significantly faster.
            </li>
            <li>
              <strong>Private partnerships only.</strong> Going forward, any ads
              you see will be from carefully selected TanStack partners — served
              directly, with no third-party tracking.
            </li>
            <li>
              <strong>Lightweight by design.</strong> Partner placements will be
              static images or text — no heavy iframes, no auction waterfalls,
              no surprise JavaScript.
            </li>
          </ul>
        </section>

        <section id="sustainability" className="space-y-4 scroll-mt-8">
          <h2 className="text-2xl font-semibold">
            <Link to="/ads" hash="sustainability" className="hover:underline">
              How We Stay Sustainable
            </Link>
          </h2>
          <p>
            TanStack is funded through a combination of{' '}
            <Link to="/partners" className="underline font-semibold">
              partnerships
            </Link>
            ,{' '}
            <a
              href="https://github.com/sponsors/tannerlinsley"
              className="underline font-semibold"
              target="_blank"
              rel="noreferrer"
            >
              GitHub sponsors
            </a>
            , and direct collaboration with companies that depend on our tools.
            This model lets us stay independent while keeping everything free
            and open source.
          </p>
        </section>

        <section id="our-commitment" className="space-y-4 scroll-mt-8">
          <h2 className="text-2xl font-semibold">
            <Link to="/ads" hash="our-commitment" className="hover:underline">
              Our Commitment
            </Link>
          </h2>
          <p>
            TanStack remains <strong>independently operated</strong> with no
            controlling interests over our technical direction and no hidden
            agendas. Our independence means we can focus on what matters:
            building great tools for developers.
          </p>
          <p>
            <Link to="/ethos" className="underline font-semibold">
              Read our ethos
            </Link>{' '}
            to learn more about how we plan on sticking around (and staying
            relevant) for the long haul.
          </p>
        </section>

        <section id="hide-ads" className="space-y-12 scroll-mt-8">
          <header>
            <h2 className="text-3xl font-black">
              <Link to="/ads" hash="hide-ads" className="hover:underline">
                Want to hide partner ads?
              </Link>
            </h2>
          </header>

          <div className="space-y-4 p-6 bg-gray-100 dark:bg-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-700">
            <h3 className="text-xl font-semibold">About This Waitlist</h3>
            <p className="text-lg font-medium">
              We're working on a way to let you hide ads on TanStack. This
              waitlist helps us understand demand and notify you when the
              feature becomes available.
            </p>
          </div>

          <div className="flex justify-center">
            <Authenticated>
              <OptInButton />
            </Authenticated>
            <Unauthenticated>
              <SignInForm />
            </Unauthenticated>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  )
}

function SignInForm() {
  return (
    <div className="bg-white dark:bg-black/30 rounded-lg shadow-lg p-8 w-[100vw] max-w-sm mx-auto">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 text-center">
        Sign in required
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
        Please sign in to join the waitlist and be notified when ad-free
        browsing becomes available.
      </p>
      <button
        onClick={() =>
          authClient.signIn.social({
            provider: 'github',
          })
        }
        className="w-full bg-black/80 hover:bg-black text-white dark:text-black dark:bg-white/95 dark:hover:bg-white font-semibold py-2 px-4 rounded-md transition-colors"
      >
        <GithubIcon className="inline-block mr-2" /> Sign in with GitHub
      </button>
      <button
        onClick={() =>
          authClient.signIn.social({
            provider: 'google',
          })
        }
        className="w-full bg-[#DB4437]/95 hover:bg-[#DB4437] text-white font-semibold py-2 px-4 rounded-md transition-colors mt-4"
      >
        <GoogleIcon className="inline-block mr-2" /> Sign in with Google
      </button>
    </div>
  )
}

function OptInButton() {
  const userQuery = useCurrentUserQuery()
  const { notify } = useToast()
  const [isInterested, setIsInterested] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (
      userQuery.data &&
      typeof userQuery.data === 'object' &&
      'interestedInHidingAds' in userQuery.data
    ) {
      setIsInterested(
        (userQuery.data as { interestedInHidingAds?: boolean })
          .interestedInHidingAds ?? false,
      )
    }
  }, [userQuery.data])

  const handleOptIn = async () => {
    setIsLoading(true)
    try {
      await setInterestedInHidingAds({ data: { interested: true } })
      setIsInterested(true)
      notify(
        <div>
          <div className="font-medium">You're on the waitlist!</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            We'll notify you when ad-free browsing becomes available
          </div>
        </div>,
      )
    } catch {
      notify(
        <div>
          <div className="font-medium">Error</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            Failed to join waitlist. Please try again.
          </div>
        </div>,
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (isInterested) {
    return (
      <div className="bg-white dark:bg-black/30 rounded-lg shadow-lg p-8 w-[100vw] max-w-sm mx-auto text-center">
        <div className="flex items-center justify-center mb-4">
          <CheckCircleIcon className="text-green-500 text-4xl" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          You're on the waitlist!
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          We'll notify you via email when ad-free browsing becomes available.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-black/30 rounded-lg shadow-lg p-8 w-[100vw] max-w-sm mx-auto">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 text-center">
        Join the waitlist
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
        Opt-in to be notified when ad-free browsing becomes available for
        TanStack.
      </p>
      <button
        onClick={handleOptIn}
        disabled={isLoading}
        className="w-full bg-black/80 hover:bg-black text-white dark:text-black dark:bg-white/95 dark:hover:bg-white font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Joining...' : 'Join Waitlist'}
      </button>
    </div>
  )
}
