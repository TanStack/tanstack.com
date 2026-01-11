import { Link, MatchRoute, createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import { Footer } from '~/components/Footer'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import discordImage from '~/images/discord-logo-white.svg'
import { useMutation } from '~/hooks/useMutation'
import { librariesByGroup, librariesGroupNamesMap, Library } from '~/libraries'
import bytesImage from '~/images/bytes.svg'
import { PartnersGrid } from '~/components/PartnersGrid'
import OpenSourceStats from '~/components/OpenSourceStats'
import { ossStatsQuery } from '~/queries/stats'
// Using public asset URLs for splash images
import { BrandContextMenu } from '~/components/BrandContextMenu'
import LandingPageGad from '~/components/LandingPageGad'
import { MaintainerCard } from '~/components/MaintainerCard'
import { coreMaintainers } from '~/libraries/maintainers'
import { useToast } from '~/components/ToastProvider'
import { formatAuthors, getPublishedPosts } from '~/utils/blog'
import { format } from '~/utils/dates'
import { SimpleMarkdown } from '~/components/SimpleMarkdown'
import { NetlifyImage } from '~/components/NetlifyImage'
import { createServerFn } from '@tanstack/react-start'
import { setResponseHeaders } from '@tanstack/react-start/server'
import { AdGate } from '~/contexts/AdsContext'
import { GamHeader } from '~/components/Gam'
import { TrustedByMarquee } from '~/components/TrustedByMarquee'
import { Layers, Zap, Shield, Code2, ArrowRight } from 'lucide-react'
import { Card } from '~/components/Card'
import LibraryCard from '~/components/LibraryCard'
import { FeaturedShowcases } from '~/components/ShowcaseSection'
import { Button } from '~/components/Button'

export const textColors = [
  `text-rose-500`,
  `text-yellow-500`,
  `text-teal-500`,
  `text-blue-500`,
]

export const gradients = [
  `from-rose-500 to-yellow-500`,
  `from-yellow-500 to-teal-500`,
  `from-teal-500 to-violet-500`,
  `from-blue-500 to-pink-500`,
]

const courses = [
  {
    name: 'The Official TanStack React Query Course',
    cardStyles: ``,
    href: 'https://query.gg/?s=tanstack',
    description: `Learn how to build enterprise quality apps with TanStack's React Query the easy way with our brand new course.`,
  },
]

type BlogFrontMatter = {
  slug: string
  title: string
  published: string
  excerpt: string | undefined
  authors: string[]
}

const fetchRecentPosts = createServerFn({ method: 'GET' }).handler(
  async (): Promise<BlogFrontMatter[]> => {
    setResponseHeaders(
      new Headers({
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Netlify-CDN-Cache-Control':
          'public, max-age=300, durable, stale-while-revalidate=300',
      }),
    )

    return getPublishedPosts()
      .slice(0, 3)
      .map((post) => {
        return {
          slug: post.slug,
          title: post.title,
          published: post.published,
          excerpt: post.excerpt,
          authors: post.authors,
        }
      })
  },
)

export const Route = createFileRoute('/_libraries/')({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(ossStatsQuery())
    const recentPosts = await fetchRecentPosts()

    return {
      recentPosts,
    }
  },
  component: Index,
})

async function bytesSignupServerFn({ email }: { email: string }) {
  'use server'

  return fetch(`https://bytes.dev/api/bytes-optin-cors`, {
    method: 'POST',
    body: JSON.stringify({
      email,
      influencer: 'tanstack',
    }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
}

function Index() {
  const bytesSignupMutation = useMutation({
    fn: bytesSignupServerFn,
  })
  const { notify } = useToast()
  const { recentPosts } = Route.useLoaderData() as {
    recentPosts: BlogFrontMatter[]
  }
  const [showShip, setShowShip] = useState(false)

  useEffect(() => {
    if (Math.random() < 0.02) {
      setShowShip(true)
    }
  }, [])

  return (
    <>
      <div className="max-w-full z-10 space-y-24">
        <div className="space-y-8">
          <div className="flex flex-col xl:flex-row items-center gap-4 xl:pt-24 xl:justify-center">
            <div
              className="relative [--ship-x:50px] [--ship-y:1.5rem] 
            lg:[--ship-x:50px] lg:[--ship-y:1.5rem]
            xl:[--ship-x:80px] xl:[--ship-y:2.5rem]
            2xl:[--ship-x:90px] 2xl:[--ship-y:3rem]"
            >
              {showShip && (
                <>
                  {/* Ship behind splash */}
                  <div className="absolute left-1/3 bottom-[25%] z-0 animate-ship-peek">
                    <NetlifyImage
                      src="/images/ship.png"
                      alt=""
                      width={80}
                      height={80}
                      className="w-16 xl:w-20"
                    />
                  </div>
                  {/* Invisible clickable ship in front */}
                  <Link
                    to="/explore"
                    className="absolute left-1/3 bottom-[25%] z-20 animate-ship-peek-clickable"
                    title="Explore TanStack"
                  >
                    <NetlifyImage
                      src="/images/ship.png"
                      alt="Explore TanStack"
                      width={80}
                      height={80}
                      className="w-16 xl:w-20 opacity-0"
                    />
                  </Link>
                </>
              )}
              <BrandContextMenu className="cursor-pointer relative z-10">
                <NetlifyImage
                  src="/images/logos/splash-light.png"
                  width={500}
                  height={500}
                  quality={85}
                  className="w-[300px] pt-8 xl:pt-0 xl:w-[400px] 2xl:w-[500px] dark:hidden"
                  alt="TanStack Logo"
                  loading="eager"
                  fetchPriority="high"
                />
                <NetlifyImage
                  src="/images/logos/splash-dark.png"
                  width={500}
                  height={500}
                  quality={85}
                  className="w-[300px] pt-8 xl:pt-0 xl:w-[400px] 2xl:w-[500px] hidden dark:block"
                  alt="TanStack Logo"
                  loading="eager"
                  fetchPriority="high"
                />
              </BrandContextMenu>
            </div>
            <div className="flex flex-col items-center gap-6 text-center px-4 xl:text-left xl:items-start">
              <div className="flex gap-2 lg:gap-4 items-center">
                <h1
                  className={`inline-block
            font-black text-5xl
            md:text-6xl
            lg:text-8xl`}
                >
                  <span
                    className={`
            inline-block text-black dark:text-white
            mb-2 uppercase [letter-spacing:-.02em] pr-1.5
            `}
                  >
                    TanStack
                  </span>
                </h1>
              </div>
              <h2
                className="font-bold text-2xl max-w-md
            md:text-4xl md:max-w-2xl
            2xl:text-5xl lg:max-w-2xl text-balance"
              >
                High-quality open-source software for{' '}
                <span className="underline decoration-dashed decoration-yellow-500 decoration-3 underline-offset-2">
                  web developers.
                </span>
              </h2>
              <p
                className="text opacity-90 max-w-sm
            lg:text-xl lg:max-w-2xl text-balance"
              >
                Headless, type-safe, & powerful utilities for Web Applications,
                Routing, State Management, Data Visualization, Datagrids/Tables,
                and more.
              </p>
            </div>
          </div>
          <div className="w-fit mx-auto px-4">
            <OpenSourceStats />
          </div>
        </div>

        <AdGate>
          <GamHeader />
        </AdGate>

        <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
          <TrustedByMarquee
            brands={[
              'Google',
              'Amazon',
              'Apple',
              'Microsoft',
              'Walmart',
              'Uber',
              'Salesforce',
              'Cisco',
              'Intuit',
              'HP',
              'Docusign',
              'TicketMaster',
              'Nordstrom',
              'Yahoo!',
            ]}
          />
        </div>

        <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
          <h3
            id="libraries"
            className={`text-4xl font-light mb-6 scroll-mt-24`}
          >
            <a
              href="#libraries"
              className="hover:underline decoration-gray-400 dark:decoration-gray-600"
            >
              Open Source Libraries
            </a>
          </h3>

          {Object.entries(librariesByGroup).map(
            ([groupName, groupLibraries]) => (
              <div key={groupName} className="mt-8">
                <h4 className={`text-2xl font-medium capitalize mb-6`}>
                  {
                    librariesGroupNamesMap[
                      groupName as keyof typeof librariesGroupNamesMap
                    ]
                  }
                </h4>
                {/* Library Cards */}
                <div
                  className={`grid grid-cols-1 gap-6 gap-y-8 justify-center
                sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3`}
                >
                  {groupLibraries.map((library, i: number) => {
                    return (
                      <LibraryCard
                        key={library.name}
                        index={i}
                        library={library as Library}
                      />
                    )
                  })}
                </div>
              </div>
            ),
          )}
        </div>

        <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto mt-8 flex justify-center">
          <Button as={Link} to="/libraries">
            More Libraries →
          </Button>
        </div>

        {/* Why TanStack Section */}
        <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
          <div className="mb-8">
            <h3 className="text-3xl font-bold">Why TanStack?</h3>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Our libraries are built on principles that put developers first
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6 rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <h4 className="font-bold text-lg mb-2">Framework Agnostic</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Every library starts with a provider-agnostic core. Use React,
                Vue, Solid, Angular, or vanilla JS—your choice.
              </p>
            </Card>
            <Card className="p-6 rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-4">
                <Code2 className="w-5 h-5 text-white" />
              </div>
              <h4 className="font-bold text-lg mb-2">Type-Safe by Design</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                First-class TypeScript support that catches bugs at compile time
                and makes refactoring fearless.
              </p>
            </Card>
            <Card className="p-6 rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mb-4">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h4 className="font-bold text-lg mb-2">Production-Grade</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Battle-tested in the world's largest apps. Built for real
                workloads, not just happy-path demos.
              </p>
            </Card>
            <Card className="p-6 rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <h4 className="font-bold text-lg mb-2">No Vendor Lock-in</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Open source and independent. No hidden agendas, no platform
                bias—just great tools for developers.
              </p>
            </Card>
          </div>
          <div className="flex justify-center mt-8">
            <Button as={Link} to="/tenets">
              Read our product tenets
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
          <h3 id="partners" className="text-3xl font-bold mb-6 scroll-mt-24">
            <a
              href="#partners"
              className="hover:underline decoration-gray-400 dark:decoration-gray-600"
            >
              Partners
            </a>
          </h3>
          <PartnersGrid />
          <div className="flex justify-center mt-6">
            <Link to="/partners" search={{ status: 'inactive' }}>
              <Button as="span">
                View Previous Partners
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
          <FeaturedShowcases />
        </div>

        {recentPosts && recentPosts.length > 0 && (
          <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
            <h3 id="blog" className="text-3xl font-bold mb-6 scroll-mt-24">
              <a
                href="#blog"
                className="hover:underline decoration-gray-400 dark:decoration-gray-600"
              >
                Latest Blog Posts
              </a>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recentPosts.map(
                ({ slug, title, published, excerpt, authors }) => {
                  return (
                    <Card
                      as={Link}
                      key={slug}
                      to="/blog/$"
                      params={{ _splat: slug } as never}
                      className={`flex flex-col gap-3 justify-between p-4
                      transition-all hover:shadow-md hover:border-blue-500
                    `}
                    >
                      <div>
                        <div className={`text-base font-bold`}>{title}</div>
                        <div
                          className={`text-xs italic font-light mt-1 text-gray-600 dark:text-gray-400`}
                        >
                          <p>
                            by {formatAuthors(authors)}
                            {published ? (
                              <time
                                dateTime={published}
                                title={format(
                                  new Date(published),
                                  'MMM dd, yyyy',
                                )}
                              >
                                {' '}
                                on {format(new Date(published), 'MMM dd, yyyy')}
                              </time>
                            ) : null}
                          </p>
                        </div>
                        {excerpt && (
                          <div
                            className={`text-xs mt-3 text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed`}
                          >
                            <SimpleMarkdown rawContent={excerpt} />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-blue-500 uppercase font-bold text-xs">
                          Read More →
                        </div>
                      </div>
                    </Card>
                  )
                },
              )}
            </div>
            <div className="flex justify-center mt-6">
              <Button as={Link} to="/blog">
                View All Posts
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        <div className={`lg:max-w-(--breakpoint-lg) px-4 mx-auto`}>
          <h3 id="courses" className="text-3xl font-bold mb-6 scroll-mt-24">
            <a
              href="#courses"
              className="hover:underline decoration-gray-400 dark:decoration-gray-600"
            >
              Courses
            </a>
          </h3>
          <div className={`mt-4 grid grid-cols-1 gap-4`}>
            {courses.map((course) => (
              <Card
                as="a"
                key={course.name}
                href={course.href}
                className={`flex gap-2 justify-between p-4 md:p-8
              transition-all hover:shadow-md hover:border-green-500
              `}
                target="_blank"
                rel="noreferrer"
              >
                <div
                  className={`col-span-2
                    md:col-span-5`}
                >
                  <div className={`text-2xl font-bold text-green-600`}>
                    {course.name}
                  </div>
                  <div className={`text-sm mt-2`}>{course.description}</div>
                  <div
                    className={`inline-block mt-4 px-4 py-2 bg-green-700 text-white rounded shadow font-black text-sm`}
                  >
                    Check it out →
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className={`lg:max-w-(--breakpoint-lg) px-4 mx-auto`}>
          <div id="sponsors" className="scroll-mt-24">
            <LazySponsorSection
              title={
                <a
                  href="#sponsors"
                  className="hover:underline decoration-gray-400 dark:decoration-gray-600"
                >
                  OSS Sponsors
                </a>
              }
            />
          </div>
          <div className={`h-4`} />
          <p
            className={`italic mx-auto max-w-(--breakpoint-sm) text-gray-500 dark:text-gray-400 text-center`}
          >
            Sponsors get special perks like{' '}
            <strong>
              private discord channels, priority issue requests, direct support
              and even course vouchers
            </strong>
            !
          </p>
        </div>

        <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
          <h3 id="maintainers" className="text-3xl font-bold mb-6 scroll-mt-24">
            <a
              href="#maintainers"
              className="hover:underline decoration-gray-400 dark:decoration-gray-600"
            >
              Core Maintainers
            </a>
          </h3>
          <div className="grid gap-6 grid-cols-2 lg:grid-cols-3">
            {coreMaintainers.map((maintainer) => (
              <MaintainerCard key={maintainer.github} maintainer={maintainer} />
            ))}
          </div>
          <div className="flex justify-center mt-6">
            <Button as={Link} to="/maintainers">
              View All Maintainers →
            </Button>
          </div>
        </div>

        <LandingPageGad />

        <div className="px-4 mx-auto max-w-(--breakpoint-lg)">
          <div
            className={`
          rounded-md p-4 grid gap-6
          bg-discord text-white overflow-hidden relative
          shadow-xl shadow-indigo-700/30
          sm:p-8 sm:grid-cols-3 items-center`}
          >
            <div
              className={`absolute transform opacity-10 z-0
            right-0 top-0 -translate-y-1/3 translate-x-1/3
            sm:opacity-20`}
            >
              <img
                src={discordImage}
                alt="Discord Logo"
                loading="lazy"
                width={300}
                height={300}
              />
            </div>
            <div className={`sm:col-span-2`}>
              <h3 id="discord" className="text-3xl font-bold scroll-mt-24">
                <a
                  href="#discord"
                  className="hover:underline decoration-white/50"
                >
                  TanStack on Discord
                </a>
              </h3>
              <p className={`mt-4`}>
                The official TanStack community to ask questions, network and
                make new friends and get lightning fast news about what's coming
                next for TanStack!
              </p>
            </div>
            <div className={`flex items-center justify-center`}>
              <Button
                as="a"
                href="https://discord.com/invite/WrRKjPJ"
                target="_blank"
                rel="noreferrer"
                className="w-full mt-4 bg-white border-white hover:bg-gray-100 text-discord justify-center shadow-lg text-sm"
              >
                Join TanStack Discord
              </Button>
            </div>
          </div>
        </div>
        <div className="h-4" />
        <div className="px-4 mx-auto max-w-(--breakpoint-lg) relative">
          <Card className="rounded-md p-8 md:p-14">
            {!bytesSignupMutation.submittedAt ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  const formData = new FormData(e.currentTarget)
                  const email = formData.get('email_address')?.toString() || ''

                  const result = await bytesSignupMutation.mutate({ email })
                  if (result?.ok) {
                    notify(
                      <div>
                        <div className="font-medium">
                          Thanks for subscribing
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 text-xs">
                          Check your email to confirm your subscription
                        </div>
                      </div>,
                    )
                  } else if (bytesSignupMutation.status === 'error') {
                    notify(
                      <div>
                        <div className="font-medium">Subscription failed</div>
                        <div className="text-gray-500 dark:text-gray-400 text-xs">
                          Please try again in a moment
                        </div>
                      </div>,
                    )
                  }
                }}
              >
                <div>
                  <div className={`relative inline-block`}>
                    <h3 id="bytes" className="text-3xl font-bold scroll-mt-24">
                      <a
                        href="#bytes"
                        className="hover:underline decoration-gray-400 dark:decoration-gray-600"
                      >
                        Subscribe to Bytes
                      </a>
                    </h3>
                    <figure className={`absolute top-0 right-[-48px]`}>
                      <img
                        src={bytesImage}
                        alt="Bytes Logo"
                        loading="lazy"
                        width={40}
                        height={40}
                      />
                    </figure>
                  </div>

                  <h3 className={`text-lg mt-1`}>
                    The Best JavaScript Newsletter
                  </h3>
                </div>
                <div className={`grid grid-cols-3 mt-4 gap-2`}>
                  <input
                    disabled={bytesSignupMutation.status === 'pending'}
                    className={`col-span-2 p-3 placeholder-gray-400 text-black bg-gray-200 rounded text-sm outline-none focus:outline-none w-full dark:(text-white bg-gray-700)`}
                    name="email_address"
                    placeholder="Your email address"
                    type="text"
                    required
                  />
                  <Button
                    type="submit"
                    className="bg-[#ED203D] border-[#ED203D] hover:bg-[#d41c35] text-white justify-center"
                  >
                    {bytesSignupMutation.status === 'pending'
                      ? 'Loading ...'
                      : 'Subscribe'}
                  </Button>
                </div>
                {bytesSignupMutation.error ? (
                  <p
                    className={`text-sm text-red-500 font-semibold italic mt-2`}
                  >
                    Looks like something went wrong. Please try again.
                  </p>
                ) : (
                  <p className={`text-sm opacity-30 font-semibold italic mt-2`}>
                    Join over 100,000 devs
                  </p>
                )}
              </form>
            ) : (
              <p>🎉 Thank you! Please confirm your email</p>
            )}
          </Card>
        </div>
        <div className={`h-20`} />
        <Footer />
      </div>
    </>
  )
}
