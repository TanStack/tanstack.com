import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'

import discordImage from '~/images/discord-logo-white.svg'
import { OptimizedImage } from '~/components/OptimizedImage'
import { useLibrariesOverlay } from '~/contexts/LibrariesOverlayContext'
import { twMerge } from 'tailwind-merge'

import {
  ArrowRight,
  Code,
  Stack,
  Shield,
  Lightning,
  Play,
  type Icon,
} from '@phosphor-icons/react'
import { YouTubeIcon } from '~/components/icons/YouTubeIcon'
import { HomeApplicationStarter } from '~/components/home/HomeApplicationStarter'
import { HomeCommunitySection } from '~/components/home/HomeCommunitySection'
import { HomeNewsletterSection } from '~/components/home/HomeNewsletterSection'
import { HomeSocialProofSection } from '~/components/home/HomeSocialProofSection'
import { HomeStatsSection } from '~/components/home/HomeStatsSection'
import { useQuery } from '@tanstack/react-query'
import { Button, Eyebrow } from '~/components/ds/ui'
import { useNpmDownloadCounter } from '~/hooks/useNpmDownloadCounter'
import { homepageNpmStatsSummaryQuery, ossStatsQuery } from '~/queries/stats'
import { useLibrariesOverlay } from '~/contexts/LibrariesOverlayContext'
import { fetchRecentPosts } from '~/utils/blog.functions'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/')({
  loader: async ({ context: { queryClient } }) => {
    const [, , recentPosts] = await Promise.all([
      queryClient.ensureQueryData(ossStatsQuery()),
      queryClient.ensureQueryData(homepageNpmStatsSummaryQuery()),
      fetchRecentPosts(),
    ])

    return { recentPosts }
  },
  head: () => ({
    meta: seo({
      title: 'TanStack | The open-source application stack for the web.',
      description:
        'Headless, type-safe, composable tools for building modern web applications that work naturally for developers and reliably for agents.',
    }),
  }),
  component: Index,
})

function Index() {
  const { recentPosts } = Route.useLoaderData()
  const { openLibraries } = useLibrariesOverlay()

  // "Start with a prompt": smooth-scroll to the app starter and focus its prompt
  // field. The starter hydrates lazily when scrolled into view, so poll briefly
  // for the textarea before focusing.
  const startWithPrompt = (e: React.MouseEvent) => {
    e.preventDefault()
    const section = document.getElementById('start-with-a-prompt')
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    let tries = 0
    const focusPrompt = () => {
      const field = section?.querySelector<HTMLTextAreaElement>('textarea')
      if (field) {
        field.focus()
        field.select()
      } else if (tries++ < 40) {
        window.setTimeout(focusPrompt, 100)
      }
    }
    window.setTimeout(focusPrompt, 350)
  }

  return (
    <>
      <div className="max-w-full z-10 space-y-24">
        <div className="space-y-8">
          {/* Hero — Figma node 802:2027. Full-bleed palm/gradient photo card:
              headline bottom-left, description + CTA bottom-right. The photo is
              always light, so text uses a mode-stable dark token (neutral-500)
              rather than a theme-flipping semantic. */}
          <div className="w-full">
            <div className="relative isolate flex min-h-[720px] flex-col justify-between gap-8 px-6 py-10 sm:px-10 xl:h-[720px] xl:min-h-0 xl:flex-row xl:items-end xl:justify-between xl:gap-12 xl:px-16 xl:py-16">
              {/* Plain <img> (not OptimizedImage): the Cloudflare transform
                  resolves against the production origin, so a newly-added asset
                  404s until deployed. The source is pre-sized (2400px, q80). */}
              <img
                src="/images/hero-palm-gradient.jpg"
                alt=""
                width={2400}
                height={1600}
                loading="eager"
                fetchPriority="high"
                className="absolute inset-2 -z-10 rounded-[2rem] object-cover object-center [corner-shape:squircle]"
              />
              <h1 className="max-w-[613px] font-ds-display text-ds-display-sm font-bold text-ds-neutral-500 sm:text-ds-display-md lg:text-ds-display-lg xl:text-ds-display-xl">
                The{' '}
                <span className="underline decoration-from-font underline-offset-[6px]">
                  open source
                </span>{' '}
                application stack for the web
              </h1>
              <div className="flex flex-col items-start gap-6 xl:max-w-[454px]">
                <p className="text-ds-body-md text-ds-neutral-500 xl:text-ds-body-xl">
                  Headless, type-safe, composable tools for building modern web
                  applications that work naturally for developers and reliably
                  for agents
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => openLibraries()}
                    variant="primary"
                    size="md"
                  >
                    Browse the Stack
                  </Button>
                  {/* Link-style button; color pinned to a mode-stable dark token
                      because the photo is always light. */}
                  <Button
                    as="a"
                    href="#start-with-a-prompt"
                    onClick={startWithPrompt}
                    variant="link"
                    size="md"
                    className="text-ds-neutral-500 hover:text-ds-neutral-500/70"
                  >
                    Start with a prompt <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div className="mx-auto mt-8 w-full max-w-[1021px] px-4 sm:px-6 md:mt-10">
            <HomeStatsSection />
          </div>
          <div
            id="start-with-a-prompt"
            className="mx-auto mt-16 w-full max-w-[1021px] scroll-mt-24 px-4 sm:px-6 md:mt-20 lg:mt-14 xl:mt-12"
          >
            <HomeApplicationStarter />
          </div>
        </div>

        <WhyTanStackSection />

        <HomeSocialProofSection recentPosts={recentPosts} />

        <HomeCommunitySection />

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

        <div className="px-4 mx-auto max-w-(--breakpoint-lg)">
          <div
            className={`
          rounded-md p-4 grid gap-6
          bg-gradient-to-br from-red-500 to-red-700 text-white overflow-hidden relative
          shadow-xl shadow-red-700/30
          sm:p-8 sm:grid-cols-3 items-center`}
          >
            <div
              className={`absolute transform opacity-10 z-0
            right-0 top-0 -translate-y-1/3 translate-x-1/3
            sm:opacity-20`}
            >
              <YouTubeIcon width={300} height={300} />
            </div>
            <div className={`sm:col-span-2`}>
              <h3 id="youtube" className="text-3xl font-bold scroll-mt-24">
                <a
                  href="#youtube"
                  className="hover:underline decoration-white/50"
                >
                  TanStack on YouTube
                </a>
              </h3>
              <p className={`mt-4`}>
                The official TanStack YouTube channel. Tutorials, deep dives,
                release walkthroughs, and more — free for everyone!
              </p>
            </div>
            <div className={`flex items-center justify-center`}>
              <Button
                as="a"
                href="https://youtube.com/@tan_stack"
                target="_blank"
                rel="noreferrer"
                className="w-full mt-4 bg-white border-white hover:bg-gray-100 text-red-600 justify-center shadow-lg text-sm"
              >
                <Play className="w-4 h-4" />
                Subscribe on YouTube
              </Button>
            </div>
          </div>
        </div>

        <div className="h-4" />
        <HomeNewsletterSection />
      </div>
    </>
  )
}

type PrincipleProof = 'adapters' | 'types' | 'adoption' | 'portable'

type WhyTanStackPrinciple = {
  label: string
  title: string
  body: string
  Icon: Icon
  accentClassName: string
  eyebrowClassName: string
  iconClassName: string
  proof: PrincipleProof
}

type AdapterGraphNode = {
  height: number
  label: string
  width: number
  x: number
  y: number
}

type AdapterGraphPoint = {
  x: number
  y: number
}

type AdapterGraphCurve = {
  control1: AdapterGraphPoint
  control2: AdapterGraphPoint
  path: string
}

// Accent hues come from the DS palette (--color-ds-*), not the library
// `category-*` tokens: these are product principles, not library categories.
// Figma specifies near-neighbours of these values (e.g. #d3481b vs the DS
// terracotta-400 #c3502b); the DS token wins per the design-system-first rule.
const whyTanStackPrinciples = [
  {
    label: 'Portable core',
    title: 'Framework Agnostic',
    body: 'Our library cores are provider-agnostic and logic-driven, meaning you can use the same logic in React, Vue, Svelte, Solid, and more.',
    Icon: Stack,
    accentClassName: 'from-blue-500 to-cyan-500',
    eyebrowClassName: 'text-ds-terracotta-400',
    iconClassName:
      'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-300',
    proof: 'adapters',
  },
  {
    label: 'Compile-time contracts',
    title: 'Type-Safe by Design',
    body: 'Built with TypeScript from the ground up, providing incredible autocomplete and safety across your entire data-fetching and state management stack.',
    Icon: Code,
    accentClassName: 'from-emerald-500 to-teal-500',
    eyebrowClassName: 'text-ds-green-400',
    iconClassName:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
    proof: 'types',
  },
  {
    label: 'Real workloads',
    title: 'Production-Grade',
    body: "Battle-tested in the world's largest apps. We build for scale, handling complex concurrency, caching, and state synchronization with ease.",
    Icon: Lightning,
    accentClassName: 'from-orange-500 to-red-500',
    eyebrowClassName: 'text-ds-blue-400',
    iconClassName:
      'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300',
    proof: 'adoption',
  },
  {
    label: 'Independent tools',
    title: 'No Vendor Lock-in',
    body: "Open source and independent. We aren't beholden to any single cloud provider or framework team, ensuring the best tools for the community.",
    Icon: Shield,
    accentClassName: 'from-purple-500 to-pink-500',
    eyebrowClassName: 'text-ds-purple-400',
    iconClassName:
      'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300',
    proof: 'portable',
  },
] satisfies ReadonlyArray<WhyTanStackPrinciple>

const adapterGraphWidth = 320
const adapterGraphHeight = 128

const frameworkAdapterCore = {
  label: 'core',
  x: 132,
  y: 58,
  width: 56,
  height: 32,
} satisfies AdapterGraphNode

const frameworkAdapterNodes = [
  { label: 'React', x: 18, y: 28, width: 60, height: 26 },
  { label: 'Vue', x: 132, y: 7, width: 56, height: 26 },
  { label: 'Solid', x: 242, y: 28, width: 60, height: 26 },
  { label: 'Angular', x: 26, y: 98, width: 78, height: 26 },
  { label: 'Vanilla', x: 216, y: 98, width: 78, height: 26 },
] satisfies ReadonlyArray<AdapterGraphNode>

const frameworkAdapterConnections = frameworkAdapterNodes.map((node) => {
  const start = edgeAnchor(frameworkAdapterCore, node)
  const end = edgeAnchor(node, frameworkAdapterCore)
  const curve = curveBetween(start, end, 0.5)

  return {
    control1: curve.control1,
    control2: curve.control2,
    end,
    label: node.label,
    path: curve.path,
    start,
  }
})

function centerPoint(node: AdapterGraphNode): AdapterGraphPoint {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  }
}

function edgeAnchor(
  node: AdapterGraphNode,
  toward: AdapterGraphNode,
): AdapterGraphPoint {
  const center = centerPoint(node)
  const targetCenter = centerPoint(toward)
  const deltaX = targetCenter.x - center.x
  const deltaY = targetCenter.y - center.y

  if (deltaX === 0 && deltaY === 0) {
    return center
  }

  const scaleX =
    deltaX === 0 ? Number.POSITIVE_INFINITY : node.width / 2 / Math.abs(deltaX)
  const scaleY =
    deltaY === 0 ? Number.POSITIVE_INFINITY : node.height / 2 / Math.abs(deltaY)
  const scale = Math.min(scaleX, scaleY)

  return {
    x: center.x + deltaX * scale,
    y: center.y + deltaY * scale,
  }
}

function curveBetween(
  start: AdapterGraphPoint,
  end: AdapterGraphPoint,
  bend = 0.5,
): AdapterGraphCurve {
  if (Math.abs(end.y - start.y) > Math.abs(end.x - start.x)) {
    const controlY = start.y + (end.y - start.y) * bend
    const control1 = { x: start.x, y: controlY }
    const control2 = { x: end.x, y: controlY }

    return {
      control1,
      control2,
      path: `M ${start.x} ${start.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${end.x} ${end.y}`,
    }
  }

  const controlX = start.x + (end.x - start.x) * bend
  const control1 = { x: controlX, y: start.y }
  const control2 = { x: controlX, y: end.y }

  return {
    control1,
    control2,
    path: `M ${start.x} ${start.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${end.x} ${end.y}`,
  }
}

function adapterGraphStyle(node: AdapterGraphNode): React.CSSProperties {
  return {
    height: `${(node.height / adapterGraphHeight) * 100}%`,
    left: `${(node.x / adapterGraphWidth) * 100}%`,
    top: `${(node.y / adapterGraphHeight) * 100}%`,
    width: `${(node.width / adapterGraphWidth) * 100}%`,
  }
}

function adapterGraphPointStyle(point: AdapterGraphPoint): React.CSSProperties {
  return {
    left: `${(point.x / adapterGraphWidth) * 100}%`,
    top: `${(point.y / adapterGraphHeight) * 100}%`,
  }
}

function cubicPoint(
  start: AdapterGraphPoint,
  control1: AdapterGraphPoint,
  control2: AdapterGraphPoint,
  end: AdapterGraphPoint,
  progress: number,
): AdapterGraphPoint {
  const inverse = 1 - progress

  return {
    x:
      inverse ** 3 * start.x +
      3 * inverse ** 2 * progress * control1.x +
      3 * inverse * progress ** 2 * control2.x +
      progress ** 3 * end.x,
    y:
      inverse ** 3 * start.y +
      3 * inverse ** 2 * progress * control1.y +
      3 * inverse * progress ** 2 * control2.y +
      progress ** 3 * end.y,
  }
}

function cubicAngle(
  start: AdapterGraphPoint,
  control1: AdapterGraphPoint,
  control2: AdapterGraphPoint,
  end: AdapterGraphPoint,
  progress: number,
): number {
  const inverse = 1 - progress
  const deltaX =
    3 * inverse ** 2 * (control1.x - start.x) +
    6 * inverse * progress * (control2.x - control1.x) +
    3 * progress ** 2 * (end.x - control2.x)
  const deltaY =
    3 * inverse ** 2 * (control1.y - start.y) +
    6 * inverse * progress * (control2.y - control1.y) +
    3 * progress ** 2 * (end.y - control2.y)

  return (Math.atan2(deltaY, deltaX) * 180) / Math.PI
}

/**
 * The "Why TanStack?" principles stack — Figma 478:1734.
 *
 * Geometry follows the design frame: a 960px column, each feature card 313px
 * tall (233px of content inside 40px padding), with the copy column and the
 * proof panel separated by a 48px gutter. The description sits bottom-right of
 * its column, which is what produces the stepped rhythm down the stack.
 */
function WhyTanStackSection() {
  return (
    <section className="px-4 md:mx-auto">
      <div className="mx-auto max-w-[960px] py-16 lg:py-20">
        {/* section-header — 478:1737 */}
        <div className="flex flex-col items-center gap-12 text-center">
          <Eyebrow className="text-text-warning">Principles</Eyebrow>
          <div className="flex flex-col items-center gap-4">
            <h3 className="text-4xl font-black leading-[1.05] tracking-[-0.8px] sm:text-5xl lg:text-[72px]">
              Why TanStack?
            </h3>
            <p className="max-w-[376px] text-sm leading-[1.45] text-gray-600 dark:text-gray-400">
              Our libraries are built around real products and the developers
              shipping them.
            </p>
          </div>
        </div>

        {/* features-stack — 478:1742 */}
        <ol className="mt-12 rounded-[20px] border border-gray-200 dark:border-gray-800">
          {whyTanStackPrinciples.map((principle, index) => (
            <li
              key={principle.title}
              className={twMerge(
                'flex flex-col gap-8 p-6 sm:p-10 lg:flex-row lg:items-start lg:gap-12',
                index < whyTanStackPrinciples.length - 1 &&
                  'border-b border-gray-200 dark:border-gray-800',
              )}
            >
              {/* copy column — 478:1745. Everything is left-aligned to the
                  card edge; justify-between keeps the eyebrow/title at the top
                  and the description pinned to the bottom of the 233px column. */}
              <div className="flex min-w-0 flex-1 flex-col gap-8 lg:h-[233px] lg:justify-between lg:gap-0">
                <div className="flex w-full flex-col gap-2">
                  <Eyebrow className={principle.eyebrowClassName}>
                    {principle.label}
                  </Eyebrow>
                  <h4 className="text-2xl font-black leading-tight text-gray-950 dark:text-white">
                    {principle.title}
                  </h4>
                </div>
                <p className="w-full text-sm font-light leading-[1.45] text-gray-600 dark:text-gray-400">
                  {principle.body}
                </p>
              </div>

              {/* proof panel — 478:1744 */}
              <PrinciplePanel>
                <PrincipleProof
                  proof={principle.proof}
                  accentClassName={principle.accentClassName}
                />
              </PrinciplePanel>
            </li>
          ))}
        </ol>

        {/* Quiet corner CTA — hugs the bottom-right of the section. Muted at
            rest so it doesn't compete with the stack; on hover the label
            brightens and the arrow slides to afford that it goes somewhere. */}
        <div className="mt-4 flex justify-end">
          <Link
            to="/tenets"
            className="group inline-flex items-center gap-1.5 rounded-md py-1 font-mono text-xs font-semibold uppercase tracking-[1px] text-gray-400 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus dark:text-gray-500 dark:hover:text-gray-100"
          >
            Read our product tenets
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </Link>
        </div>
      </div>
    </section>
  )
}

/**
 * The 460×233 proof slot from Figma (478:1744 et al).
 *
 * Deliberately chrome-less: no border, no fill. The design draws a surface
 * here, but the proofs read better floating directly on the card — the row
 * dividers and the 48px gutter already separate them from the copy, so a
 * second frame around each one was redundant weight.
 */
function PrinciplePanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[233px] w-full shrink-0 items-center justify-center lg:w-[460px]">
      {children}
    </div>
  )
}

function FrameworkAdapterGraph({
  accentClassName,
}: {
  accentClassName: string
}) {
  const [activeAdapterIndex, setActiveAdapterIndex] = React.useState(0)
  const [flowProgress, setFlowProgress] = React.useState(0)

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveAdapterIndex(
        (currentIndex) => (currentIndex + 1) % frameworkAdapterNodes.length,
      )
    }, 1150)

    return () => window.clearInterval(intervalId)
  }, [])

  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    let frameId = 0
    let lastUpdate = 0
    const duration = 1500

    const update = (timestamp: number) => {
      if (timestamp - lastUpdate > 33) {
        setFlowProgress((timestamp % duration) / duration)
        lastUpdate = timestamp
      }

      frameId = window.requestAnimationFrame(update)
    }

    frameId = window.requestAnimationFrame(update)

    return () => window.cancelAnimationFrame(frameId)
  }, [])

  return (
    // The node positions below are hard-coded against a 320×128 grid
    // (adapterGraphWidth/Height), so the whole graph is scaled as a unit to
    // fill the 460×233 slot rather than re-deriving every coordinate.
    <div
      aria-hidden="true"
      className="relative h-32 w-[320px] shrink-0 scale-[1.35] font-mono text-[10px] font-bold"
    >
      <div className="home-adapter-graph absolute inset-x-0 top-1 h-[7.5rem] overflow-visible">
        {frameworkAdapterNodes.map((adapter, adapterIndex) => {
          const isActive = activeAdapterIndex === adapterIndex

          return (
            <span
              key={adapter.label}
              data-adapter-label={adapter.label}
              style={adapterGraphStyle(adapter)}
              className={twMerge(
                'absolute z-20 flex items-center justify-center rounded-md border px-2 text-center text-gray-600 shadow-sm backdrop-blur transition-colors duration-500 dark:text-gray-400',
                isActive
                  ? 'border-cyan-300 bg-cyan-50 text-cyan-800 shadow-cyan-500/15 dark:border-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-200'
                  : 'border-gray-200 bg-white/85 dark:border-gray-800 dark:bg-black/55',
              )}
            >
              {adapter.label}
            </span>
          )
        })}

        <span
          data-adapter-label={frameworkAdapterCore.label}
          style={adapterGraphStyle(frameworkAdapterCore)}
          className={twMerge(
            'absolute z-30 flex items-center justify-center rounded-lg bg-gradient-to-r text-center text-[11px] text-white shadow-lg shadow-cyan-500/15',
            accentClassName,
          )}
        >
          core
        </span>

        {frameworkAdapterConnections.map((connection, connectionIndex) => {
          const progress = (flowProgress - connectionIndex * 0.13 + 1) % 1
          const point = cubicPoint(
            connection.start,
            connection.control1,
            connection.control2,
            connection.end,
            progress,
          )
          const angle = cubicAngle(
            connection.start,
            connection.control1,
            connection.control2,
            connection.end,
            progress,
          )

          return (
            <span
              key={`flow-${connection.label}`}
              data-connection-flow={connection.label}
              style={{
                ...adapterGraphPointStyle(point),
                transform: `translate(-50%, -50%) rotate(${angle}deg)`,
              }}
              className={twMerge(
                'home-adapter-graph-flow absolute z-50',
                progress < 0.08 || progress > 0.92
                  ? 'opacity-0'
                  : 'opacity-100',
              )}
            />
          )
        })}

        {frameworkAdapterConnections.map((connection, connectionIndex) => {
          const isActive = activeAdapterIndex === connectionIndex

          return (
            <React.Fragment key={`ports-${connection.label}`}>
              <span
                data-connection-port={`${connection.label}-core`}
                style={adapterGraphPointStyle(connection.start)}
                className={twMerge(
                  'absolute z-40 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.55)] transition-opacity duration-500 dark:border-cyan-900',
                  isActive ? 'opacity-100' : 'opacity-55',
                )}
              />
              <span
                data-connection-port={`${connection.label}-adapter`}
                style={adapterGraphPointStyle(connection.end)}
                className={twMerge(
                  'absolute z-40 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.55)] transition-opacity duration-500 dark:border-cyan-900',
                  isActive ? 'opacity-100' : 'opacity-55',
                )}
              />
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

function PrincipleProof({
  proof,
  accentClassName,
}: {
  proof: PrincipleProof
  accentClassName: string
}) {
  if (proof === 'adapters') {
    return <FrameworkAdapterGraph accentClassName={accentClassName} />
  }

  if (proof === 'types') {
    return (
      <div className="w-full font-mono text-base leading-7">
        <div className="flex flex-col gap-3 text-left text-gray-600 dark:text-gray-400">
          {[
            ['params.postId', 'string'],
            ['query.data', 'Project[]'],
            ['form.email', 'Field<string>'],
          ].map(([name, value]) => (
            <div
              key={name}
              className="flex items-baseline justify-between gap-4"
            >
              <span>{name}</span>
              <span
                className={twMerge(
                  'bg-gradient-to-r bg-clip-text font-black text-transparent',
                  accentClassName,
                )}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (proof === 'adoption') {
    return <AdoptionProof accentClassName={accentClassName} />
  }

  return <IndependenceProof accentClassName={accentClassName} />
}

/**
 * Production-Grade proof: the live npm download odometer already prefetched by
 * the route loader, plus weekly volume and stars. Real numbers rather than
 * adjectives — the point of the principle is scale.
 */
function AdoptionProof({ accentClassName }: { accentClassName: string }) {
  const { data: summary } = useQuery(homepageNpmStatsSummaryQuery())
  const { data: stats } = useQuery(ossStatsQuery())

  const totalDownloads = summary?.totalDownloads ?? 0
  const weeklyDownloads = summary?.weeklyDownloads ?? 0
  const starCount = stats?.github?.starCount ?? 0

  // npm can be slow, rate-limited, or down — showing a literal 0 would claim
  // this library has no users. Fall back to a placeholder instead.
  const format = (value: number) => (value > 0 ? value.toLocaleString() : '—')

  const counterRef = useNpmDownloadCounter({
    totalDownloads,
    ratePerDay: summary?.weeklyRatePerDay ?? 0,
  })

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-500">
          npm downloads
        </span>
        <span
          // The odometer writes into this node directly; only hand it over
          // once there is a real number for it to count from.
          ref={totalDownloads > 0 ? counterRef : undefined}
          className={twMerge(
            'bg-linear-to-r bg-clip-text font-mono text-4xl font-black tabular-nums text-transparent',
            accentClassName,
          )}
        >
          {format(totalDownloads)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-6 font-mono">
        {[
          ['per week', weeklyDownloads],
          ['github stars', starCount],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-500">
              {label}
            </span>
            <span className="text-xl font-black tabular-nums text-gray-700 dark:text-gray-300">
              {format(Number(value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * No Vendor Lock-in proof: the same four claims the chip list made, but as a
 * checked ledger so the panel reads as substantiated rather than decorative.
 */
function IndependenceProof({ accentClassName }: { accentClassName: string }) {
  return (
    <dl className="flex w-full flex-col font-mono text-sm">
      {[
        ['license', 'MIT'],
        ['hosting', 'self-host anywhere'],
        ['governance', 'community-driven'],
        ['paid tiers', 'none'],
      ].map(([term, value], index) => (
        <div
          key={term}
          className={twMerge(
            'flex items-baseline justify-between gap-4 py-3',
            index > 0 && 'border-t border-gray-200/70 dark:border-gray-800/70',
          )}
        >
          <dt className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-500">
            {term}
          </dt>
          <dd
            className={twMerge(
              'bg-linear-to-r bg-clip-text font-black text-transparent',
              accentClassName,
            )}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
