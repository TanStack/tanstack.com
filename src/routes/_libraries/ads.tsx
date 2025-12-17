import { createFileRoute, Link } from '@tanstack/react-router'
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

export const Route = createFileRoute('/_libraries/ads')({
  component: RouteComp,
  head: () => ({
    meta: seo({
      title: 'Why Ads? | TanStack',
      description:
        'How we believe ads can tastefully play a part in sustainability for Open Source Software.',
    }),
  }),
})

function RouteComp() {
  return (
    <div className="flex flex-col max-w-full min-h-screen gap-12 p-4 md:p-8 pb-0">
      <div className="flex-1 space-y-12 w-full max-w-3xl mx-auto">
        <header className="">
          <h1 className="text-3xl font-black">Why Ads?</h1>
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
            paid upsells, or licencing shenanigans. The ads you see help us keep
            it that way.
          </p>
        </section>

        <section className="">
          <p>
            If you're seeing ads on TanStack's website, you might be wondering
            why. After all, ads on open source projects can feel like a
            throwback to the early web—or worse, a sign that something has gone
            wrong.
          </p>
        </section>

        <section className="space-y-4">
          <p>
            But here's the reality: TanStack is{' '}
            <strong>100% privately owned</strong> with no paid products, no
            venture capital, and no acquisition plans. We're a small,
            independent team dedicated to creating open source software used by
            millions of developers daily. To keep building and maintaining these
            tools for the long term, we need sustainable funding—and that's
            where advertising comes in.
          </p>
        </section>

        <section id="sustainable-open-source" className="space-y-4 scroll-mt-8">
          <h2 className="text-2xl font-semibold">
            <Link
              to="/ads"
              hash="sustainable-open-source"
              className="hover:underline"
            >
              Sustainable Open Source Through Advertising
            </Link>
          </h2>
          <p>
            We believe advertising can support open source sustainability while
            maintaining our core values. Our approach to ads is guided by a few
            key principles:
          </p>
          <ul className="list-disc pl-8 space-y-2">
            <li>
              <strong>Thoughtful placement:</strong> We place ads where they're
              least disruptive to the core developer experience and
              documentation.
            </li>
            <li>
              <strong>Quality over quantity:</strong> We work with partners who
              share our values and respect the developer community.
            </li>
            <li>
              <strong>Transparency:</strong> We're upfront about our funding
              model and why ads are necessary for sustainability.
            </li>
            <li>
              <strong>User control:</strong> We respect user preferences and
              provide options to manage ad preferences.
            </li>
          </ul>
          <p>
            Beyond direct revenue, ad performance also serves as a baseline for
            our partnership and sponsorship pricing. This helps us stay
            relevant, grounded, and competitive—ensuring our pricing reflects
            the real value our platform delivers to partners.
          </p>
        </section>

        <section id="our-commitment" className="space-y-4 scroll-mt-8">
          <h2 className="text-2xl font-semibold">
            <Link to="/ads" hash="our-commitment" className="hover:underline">
              Our Commitment
            </Link>
          </h2>
          <p>
            TanStack remains <strong>100% privately owned</strong> with no
            external investors, no controlling interests, and no hidden agendas.
            Our independence means we can focus on what matters: building great
            tools for developers.
          </p>
          <p>
            The revenue from ads helps us maintain our libraries, support our
            community, and continue building the open source tools that millions
            of developers rely on daily.
          </p>
        </section>

        <section id="looking-forward" className="space-y-4 scroll-mt-8">
          <h2 className="text-2xl font-semibold">
            <Link to="/ads" hash="looking-forward" className="hover:underline">
              Looking Forward
            </Link>
          </h2>
          <p>
            <Link to="/ethos" className="underline font-semibold">
              Check out our ethos
            </Link>{' '}
            to learn more about how we plan on sticking around (and staying
            relevant) for the long-haul.
          </p>
          <p>
            We're committed to finding sustainable ways to fund open source
            development that don't compromise our values or your experience. Ads
            are just one part of that equation, and we're always exploring new
            approaches that align with our mission.
          </p>
        </section>

        <section id="hide-ads" className="space-y-12 scroll-mt-8">
          <header className="">
            <h2 className="text-3xl font-black">
              <Link to="/ads" hash="hide-ads" className="hover:underline">
                Want to hide our ads?
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
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 text-center">
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

  // Using server function wrapper to handle authentication via session cookie

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
    } catch (error) {
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
        <p className="text-sm text-gray-600 dark:text-gray-300">
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
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 text-center">
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
