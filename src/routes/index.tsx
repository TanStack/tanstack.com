import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'

import { twMerge } from 'tailwind-merge'

import {
  ArrowRightIcon,
  CodeIcon,
  StackIcon,
  ShieldIcon,
  LightningIcon,
  PauseIcon,
  PlayIcon,
  type Icon,
} from '@phosphor-icons/react'
import { HomeApplicationStarter } from '~/components/home/HomeApplicationStarter'
import { HomeCommunitySection } from '~/components/home/HomeCommunitySection'
import { HomeNewsletterSection } from '~/components/home/HomeNewsletterSection'
import { HomeSocialProofSection } from '~/components/home/HomeSocialProofSection'
import { HomeStatsSection } from '~/components/home/HomeStatsSection'
import { useQuery } from '@tanstack/react-query'
import { Button, Eyebrow } from '~/components/ds/ui'
import { Squircle } from '~/components/Squircle'
import { useInView } from '~/hooks/useInView'
import { useNpmDownloadCounter } from '~/hooks/useNpmDownloadCounter'
import { homepageNpmStatsSummaryQuery, ossStatsQuery } from '~/queries/stats'
import { useLibrariesOverlay } from '~/contexts/LibrariesOverlayContext'
import { fetchRecentPosts } from '~/utils/blog.functions'
import { usePrefersReducedMotion } from '~/utils/usePrefersReducedMotion'
import { seo } from '~/utils/seo'
import { getTanStackHomepageJsonLd } from '~/utils/organization-structured-data'

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
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(getTanStackHomepageJsonLd()),
      },
    ],
  }),
  component: Index,
})

function Index() {
  const { recentPosts } = Route.useLoaderData()
  const { openLibraries } = useLibrariesOverlay()

  const startWithPrompt = (e: React.MouseEvent) => {
    e.preventDefault()
    const section = document.getElementById('start-with-a-prompt')
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const field = section?.querySelector<HTMLTextAreaElement>('textarea')
    if (field) {
      field.focus()
      field.select()
    } else if (section) {
      section.dataset.focusPrompt = 'true'
    }
  }

  return (
    <>
      <div className="max-w-full z-10 space-y-24">
        <div className="space-y-8">
          {/* Hero — Figma node 802:2027. Full-bleed palm/gradient photo card:
              headline bottom-left, description + CTA bottom-right. The photo is
              always light, so text uses a mode-stable dark token (neutral-500)
              rather than a theme-flipping semantic. */}
          <div className="mx-0 rounded-none bg-background-subtle p-0 sm:mx-2 sm:rounded-2xl sm:p-1">
            {/* `svh`, not `dvh` — the dynamic viewport grows as iOS collapses
                the URL bar mid-scroll, visibly stretching the hero. */}
            <div className="group relative isolate flex h-[calc(100svh-var(--navbar-height))] max-h-[720px] min-h-[560px] flex-col justify-between gap-8 overflow-hidden rounded-none px-6 py-10 [text-shadow:0_2px_8px_rgb(255_255_255/0.2)] sm:rounded-xl sm:px-10 md:flex-row md:items-end md:justify-between md:gap-8 md:[text-shadow:none] xl:gap-12 xl:px-16 xl:py-16">
              {/* The parent supplies the 4px frame shared by the hero and stats.
                  This wrapper clips the image to the inner radius so the <img>
                  fills it exactly instead of overflowing. Plain <img> (not OptimizedImage):
                  the Cloudflare transform resolves against the production origin,
                  so a newly-added asset 404s until deployed. */}
              <HeroPalmMedia />
              <h1 className="max-w-[613px] font-ds-display text-ds-display-sm font-bold text-ds-neutral-500 md:w-[47%] md:text-[clamp(2rem,4.3vw,4rem)] md:leading-[1.1] md:tracking-[-0.025em] xl:leading-[1.08]">
                The{' '}
                <span className="underline decoration-from-font underline-offset-[6px]">
                  open source
                </span>
                <br className="hidden md:block" /> application stack
                <br className="hidden md:block" /> for the web
              </h1>
              <div className="flex flex-col items-start gap-6 md:w-[29%] md:max-w-[454px]">
                <p className="hidden text-ds-body-md text-ds-neutral-500 md:block md:text-ds-body-lg xl:text-ds-body-xl">
                  Headless, type-safe, composable tools for building modern web
                  applications that work naturally for developers and reliably
                  for agents
                </p>
                {/* The photo is always light, so scope the CTAs to the DS
                    light mode — the Buttons then render as their standard DS
                    light-mode selves (no per-button color overrides). */}
                <div className="ds-mode-light flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => openLibraries()}
                    variant="primary"
                    size="md"
                  >
                    Browse the Stack
                  </Button>
                  <Button
                    as="a"
                    href="#start-with-a-prompt"
                    onClick={startWithPrompt}
                    variant="link"
                    size="md"
                  >
                    Start with a prompt <ArrowRightIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center px-2.5 py-6">
              <HomeStatsSection />
            </div>
          </div>
          <div
            id="start-with-a-prompt"
            className="mx-auto mt-16 w-full max-w-[1021px] scroll-mt-24 px-4 sm:px-6 md:mt-20"
          >
            <HomeApplicationStarter />
          </div>
        </div>

        <WhyTanStackSection />

        <HomeSocialProofSection recentPosts={recentPosts} />

        <HomeCommunitySection />

        <div className="h-4" />
        <HomeNewsletterSection />
      </div>
    </>
  )
}

function HeroPalmMedia() {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = React.useState(true)

  React.useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const syncMotionPreference = () => {
      if (reducedMotion.matches) {
        videoRef.current?.pause()
      }
    }

    syncMotionPreference()
    reducedMotion.addEventListener('change', syncMotionPreference)
    return () =>
      reducedMotion.removeEventListener('change', syncMotionPreference)
  }, [])

  const togglePlayback = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      void video.play()
    } else {
      video.pause()
    }
  }

  return (
    <>
      <Squircle
        aria-hidden
        className="absolute inset-0 -z-10 overflow-hidden rounded-xl [corner-shape:squircle]"
      >
        <picture className="contents">
          <source
            type="image/webp"
            srcSet="/images/hero-palm-gradient-960.webp 960w, /images/hero-palm-gradient-1600.webp 1600w, /images/hero-palm-gradient-2400.webp 2400w"
            sizes="100vw"
          />
          <img
            src="/images/hero-palm-gradient.jpg"
            alt=""
            width={2400}
            height={1600}
            loading="eager"
            fetchPriority="high"
            className="h-full w-full object-cover object-center"
          />
        </picture>
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          poster="/images/hero-palm-gradient.jpg"
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          className="absolute inset-0 h-full w-full object-cover object-center motion-reduce:hidden"
        >
          <source src="/images/hero-palm-motion.mp4" type="video/mp4" />
        </video>
      </Squircle>
      <button
        type="button"
        onClick={togglePlayback}
        aria-label={isPlaying ? 'Pause hero animation' : 'Play hero animation'}
        className="absolute right-4 top-4 z-20 grid size-8 place-items-center rounded-full bg-ds-neutral-500/65 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-ds-neutral-500/80 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white group-hover:opacity-100 motion-reduce:hidden"
      >
        {isPlaying ? (
          <PauseIcon className="size-4" weight="fill" />
        ) : (
          <PlayIcon className="size-4" weight="fill" />
        )}
      </button>
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
    Icon: StackIcon,
    accentClassName: 'from-blue-500 to-cyan-500',
    eyebrowClassName: 'text-category-ui',
    iconClassName:
      'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-300',
    proof: 'adapters',
  },
  {
    label: 'Compile-time contracts',
    title: 'Type-Safe by Design',
    body: 'Built with TypeScript from the ground up, providing incredible autocomplete and safety across your entire data-fetching and state management stack.',
    Icon: CodeIcon,
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
    Icon: LightningIcon,
    accentClassName: 'from-orange-500 to-red-500',
    eyebrowClassName: 'text-ds-terracotta-400',
    iconClassName:
      'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300',
    proof: 'adoption',
  },
  {
    label: 'Independent tools',
    title: 'No Vendor Lock-in',
    body: "Open source and independent. We aren't beholden to any single cloud provider or framework team, ensuring the best tools for the community.",
    Icon: ShieldIcon,
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
          <Eyebrow tone="warning">Principles</Eyebrow>
          <div className="flex flex-col items-center gap-4">
            <h3 className="text-4xl font-[500] leading-[1.05] tracking-[-0.8px] sm:text-5xl lg:text-[64px]">
              Why TanStack?
            </h3>
            <p className="max-w-[376px] text-base leading-[1.45] text-gray-600 dark:text-gray-400">
              Our libraries are built around real products and the developers
              shipping them.
            </p>
          </div>
        </div>

        {/* features-stack — 478:1742 */}
        <ol className="mt-12 rounded-[20px]">
          {whyTanStackPrinciples.map((principle, index) => (
            <li
              key={principle.title}
              className={twMerge(
                'flex flex-col gap-8 p-6 sm:p-10 lg:flex-row lg:items-center lg:justify-center lg:gap-[70px]',
                index < whyTanStackPrinciples.length - 1 &&
                  'border-b border-gray-200 dark:border-gray-800',
              )}
            >
              {/* copy column — 478:1745. Everything is left-aligned to the
                  card edge; at desktop sizes the title and description stay
                  grouped at the center of the 233px proof panel. */}
              <div className="flex min-w-0 flex-1 flex-col gap-8 lg:h-[233px] lg:justify-center lg:gap-0">
                <div className="flex w-full flex-col gap-2">
                  <Eyebrow className={principle.eyebrowClassName}>
                    {principle.label}
                  </Eyebrow>
                  <h4 className="text-2xl font-black leading-tight text-gray-950 dark:text-white">
                    {principle.title}
                  </h4>
                </div>
                <p className="w-full text-sm font-light leading-[1.45] text-gray-600 dark:text-gray-400 lg:pt-4">
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
            <ArrowRightIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
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
 * dividers and the 70px gutter already separate them from the copy, so a
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
  const rootRef = React.useRef<HTMLDivElement>(null)
  const isVisible = useInView(rootRef)
  const prefersReducedMotion = usePrefersReducedMotion()

  React.useEffect(() => {
    if (!isVisible || prefersReducedMotion !== false) return

    const intervalId = window.setInterval(() => {
      setActiveAdapterIndex(
        (currentIndex) => (currentIndex + 1) % frameworkAdapterNodes.length,
      )
    }, 1150)

    return () => window.clearInterval(intervalId)
  }, [isVisible, prefersReducedMotion])

  React.useEffect(() => {
    if (!isVisible || prefersReducedMotion !== false) return

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
  }, [isVisible, prefersReducedMotion])

  return (
    // The node positions below are hard-coded against a 320×128 grid
    // (adapterGraphWidth/Height), so the whole graph is scaled as a unit rather
    // than re-deriving every coordinate. The scale tracks the wrapper's own
    // width, so the graph fills whatever slot it lands in without restating the
    // ancestors' padding. The 1.35 cap is the ratio the fixed 460px `lg` slot
    // was designed around.
    <div className="@container flex w-full justify-center">
      <div
        ref={rootRef}
        aria-hidden="true"
        style={{
          transform: 'scale(clamp(0.75, calc(100cqw / 320px), 1.35))',
        }}
        className="relative h-32 w-[320px] shrink-0 origin-center font-mono text-[10px] font-bold"
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
            'bg-linear-to-r bg-clip-text font-mono text-3xl font-black tabular-nums text-transparent sm:text-4xl',
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
