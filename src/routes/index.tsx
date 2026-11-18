import { homepageScarfPixel } from '~/utils/analytics/scarf-pixels'
import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'

import { twMerge } from 'tailwind-merge'

import { ArrowRightIcon } from '@phosphor-icons/react'
import { HeroPalmMedia } from '~/components/home/HeroPalmMedia'
import { HomeApplicationStarter } from '~/components/home/HomeApplicationStarter'
import { HomeCommunitySection } from '~/components/home/HomeCommunitySection'
import { HomeNewsletterSection } from '~/components/home/HomeNewsletterSection'
import { HomeSocialProofSection } from '~/components/home/HomeSocialProofSection'
import { HomeStatsSection } from '~/components/home/HomeStatsSection'
import { useQuery } from '@tanstack/react-query'
import { Button, Eyebrow } from '~/components/ds/ui'
import { Scarf } from '~/components/Scarf'
import { useInView } from '~/hooks/useInView'
import { useNpmDownloadCounter } from '~/hooks/useNpmDownloadCounter'
import { homepageNpmStatsSummaryQuery, ossStatsQuery } from '~/queries/stats'
import { useLibrariesOverlay } from '~/contexts/LibrariesOverlayContext'
import { fetchRecentPosts } from '~/utils/blog.functions'
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
      <Scarf id={homepageScarfPixel} path="/" />
      <main className="home-grain max-w-full z-10 space-y-24 md:space-y-32 lg:space-y-40">
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
              <p className="max-w-[15rem] text-balance text-ds-body-md text-ds-neutral-500 md:max-w-none xl:text-ds-body-lg">
                Headless, type-safe, composable tools for building modern web
                applications that work naturally for developers and reliably for
                agents
              </p>
              {/* The photo is always light, so scope the CTAs to the DS
                    light mode — the Buttons then render as their standard DS
                    light-mode selves (no per-button color overrides). */}
              <div className="ds-mode-light flex flex-wrap items-center gap-2">
                <Button
                  as="a"
                  href="/libraries"
                  onClick={(event) => {
                    if (
                      event.button !== 0 ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return
                    event.preventDefault()
                    openLibraries()
                  }}
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
          className="w-full scroll-mt-24 px-4 md:mx-auto lg:max-w-(--breakpoint-lg)"
        >
          <HomeApplicationStarter />
        </div>

        <WhyTanStackSection />

        <HomeSocialProofSection recentPosts={recentPosts} />

        <HomeCommunitySection />

        <HomeNewsletterSection />
      </main>
    </>
  )
}

type PrincipleProof = 'adapters' | 'types' | 'adoption' | 'portable'

type WhyTanStackPrinciple = {
  phrase: string
  title: string
  body: string
  // Literal classes so Tailwind emits them.
  // The phrase's resting color, reused for its detail heading.
  colorClassName: string
  // The filled block with black type, shown on hover or while open.
  fillClassName: string
  // Photo printed into the fill while the phrase is hovered or open.
  pattern: FillPattern
  proof: PrincipleProof
}

type FillPattern = Pick<
  React.CSSProperties,
  | 'backgroundImage'
  | 'backgroundSize'
  | 'backgroundPosition'
  | 'backgroundBlendMode'
>

/**
 * A grayscale photo blended into a phrase's filled block, so it reads as a
 * one-color print in the phrase's own color.
 *
 * `screen` (the default) can only lighten the fill, so the black type is never
 * less readable than on the flat color. `multiply` is for fills already too
 * pale for a lighter print to show; its image must be high-key (no dark tones).
 */
function photoFill(
  src: string,
  blend: 'screen' | 'multiply' = 'screen',
): FillPattern {
  return {
    backgroundImage: `url(${src})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundBlendMode: blend,
  }
}

const whyTanStackPrinciples = [
  {
    phrase: 'framework agnostic',
    title: 'One core, every framework.',
    body: 'The logic lives in a framework-free core. Thin adapters bring it to React, Vue, Solid, Svelte, Angular, or plain JavaScript, so switching frameworks does not mean relearning your tools.',
    fillClassName:
      'bg-ds-blue-400 text-black dark:bg-ds-blue-300 dark:text-black',
    pattern: photoFill('/images/home/why-fill-water.webp'),
    colorClassName: 'text-ds-blue-500 dark:text-ds-blue-300',
    proof: 'adapters',
  },
  {
    phrase: 'type-safe',
    title: 'Types that follow your data.',
    body: 'Written in TypeScript from the first line. Route params, query results, and form fields arrive already typed, so your editor catches the mistake before you run the code.',
    fillClassName:
      'bg-ds-green-400 text-black dark:bg-ds-green-300 dark:text-black',
    pattern: photoFill('/images/home/why-fill-palm.webp'),
    colorClassName: 'text-ds-green-500 dark:text-ds-green-300',
    proof: 'types',
  },
  {
    phrase: 'production-grade',
    title: 'Built for real workloads.',
    body: 'Caching, concurrency, and keeping state in sync are the hard parts of an app. The libraries handle them for you, so growing does not force a rewrite.',
    fillClassName:
      'bg-ds-terracotta-400 text-black dark:bg-ds-terracotta-300 dark:text-black',
    pattern: photoFill('/images/home/why-fill-sun.webp'),
    colorClassName: 'text-ds-terracotta-400 dark:text-ds-terracotta-300',
    proof: 'adoption',
  },
  {
    phrase: 'yours to keep',
    title: 'Yours to keep.',
    body: 'Open source and independent. No cloud provider or framework team sets the roadmap, and you can host what you build anywhere.',
    fillClassName:
      'bg-ds-amber-400 text-black dark:bg-ds-amber-300 dark:text-black',
    pattern: photoFill('/images/home/why-fill-sand.webp', 'multiply'),
    colorClassName: 'text-ds-amber-500 dark:text-ds-amber-300',
    proof: 'portable',
  },
] satisfies ReadonlyArray<WhyTanStackPrinciple>

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

  return { label: node.label, path: curve.path }
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

/**
 * "Why TanStack?" as one sentence. Each claim in the sentence is a control:
 * hovering tints it, selecting it opens that principle's explanation and proof
 * underneath. Nothing but the sentence shows until the reader asks.
 */
function WhyTanStackSection() {
  // `shown` keeps the last principle mounted while the panel collapses.
  const [isOpen, setIsOpen] = React.useState(false)
  const [shown, setShown] = React.useState(0)
  // Only one block is ever filled: the phrase under the pointer, or failing
  // that the open one. Hovering another phrase takes the fill from the open one.
  const [hovered, setHovered] = React.useState<number | null>(null)
  // Leaving a phrase clears the hover a beat late. Crossing the gap to the next
  // phrase would otherwise report "nothing hovered" for a frame or two, and the
  // open phrase's fill would flash on and off in between.
  const clearHoverTimer = React.useRef<number | undefined>(undefined)
  const hoverPhrase = (index: number) => {
    window.clearTimeout(clearHoverTimer.current)
    setHovered(index)
  }
  const leavePhrase = () => {
    window.clearTimeout(clearHoverTimer.current)
    clearHoverTimer.current = window.setTimeout(() => setHovered(null), 120)
  }
  React.useEffect(() => () => window.clearTimeout(clearHoverTimer.current), [])
  const principle = whyTanStackPrinciples[shown]

  return (
    <section className="px-4 py-8 md:mx-auto md:py-16 lg:max-w-(--breakpoint-lg) lg:py-24">
      <Eyebrow>Why TanStack?</Eyebrow>
      {/* From `sm` up the sentence is set as two fixed lines and sized off the
          container, so the longer first line spans the content width (it
          measures about 19.3em, hence 5.1cqw). */}
      <div className="@container mt-8">
        <h2 className="text-balance font-ds-display text-ds-heading-2 leading-[1.15] text-text-primary sm:whitespace-nowrap sm:text-[length:5.1cqw]">
          TanStack is{' '}
          {whyTanStackPrinciples.map((item, index) => {
            const isLast = index === whyTanStackPrinciples.length - 1
            const isActive = isOpen && shown === index
            const isFilled = hovered === index || (isActive && hovered === null)

            return (
              <React.Fragment key={item.phrase}>
                {isLast ? 'and ' : null}
                {/* Keeps the trailing comma/period on the phrase's line. */}
                <span className="whitespace-nowrap">
                  <button
                    type="button"
                    aria-expanded={isActive}
                    aria-controls="why-tanstack-detail"
                    onClick={() => {
                      setShown(index)
                      setIsOpen(!isActive)
                    }}
                    onPointerEnter={(event) => {
                      if (event.pointerType === 'mouse') hoverPhrase(index)
                    }}
                    onPointerLeave={leavePhrase}
                    style={isFilled ? item.pattern : undefined}
                    className={twMerge(
                      // The block's leading is tighter than the sentence's so
                      // blocks on adjacent lines never touch.
                      '-mx-1 cursor-pointer rounded-md px-1 leading-[1.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                      // No transition on purpose. The type and the fill swap
                      // contrast (colored-on-dark to black-on-color), so any fade
                      // passes through a frame where the two match and the phrase
                      // blinks. An instant swap is the only flicker-free option.
                      isFilled ? item.fillClassName : item.colorClassName,
                    )}
                  >
                    {item.phrase}
                  </button>
                  {isLast ? '.' : ','}
                </span>
                {isLast ? null : index === 1 ? (
                  <>
                    {' '}
                    <br className="hidden sm:block" />
                  </>
                ) : (
                  ' '
                )}
              </React.Fragment>
            )
          })}
        </h2>
      </div>

      <div
        id="why-tanstack-detail"
        className={twMerge(
          'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!isOpen}>
          <div
            key={principle.phrase}
            className="ds-enter-rise mt-8 flex flex-col gap-8 border-t border-border-default pt-8 lg:flex-row lg:items-center lg:gap-16"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {/* Template string, not twMerge: it reads the type-scale and
                  color utilities as one conflicting `text-*` group. */}
              <h3
                className={`font-ds-display text-ds-heading-2 ${principle.colorClassName}`}
              >
                {principle.title}
              </h3>
              <p className="max-w-[44ch] pt-2 text-ds-body-md text-text-secondary">
                {principle.body}
              </p>
            </div>
            <div className="flex w-full shrink-0 items-center justify-center lg:min-h-[200px] lg:w-[460px]">
              <PrincipleProof proof={principle.proof} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-14 flex">
        <Link
          to="/tenets"
          className="group inline-flex items-center gap-1.5 rounded-md py-1 font-ds-mono text-ds-mono-caps uppercase text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          Read our product tenets
          <ArrowRightIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Link>
      </div>
    </section>
  )
}

function FrameworkAdapterGraph() {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const isVisible = useInView(rootRef, { threshold: 0.6 })
  // Draw the connectors once, the first time the graph scrolls into view,
  // then leave it at rest.
  const [hasEntered, setHasEntered] = React.useState(false)
  if (isVisible && !hasEntered) setHasEntered(true)

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
        className="relative h-32 w-[320px] shrink-0 origin-center font-ds-mono text-[10px] font-medium"
      >
        <div className="absolute inset-x-0 top-1 h-[7.5rem]">
          <svg
            viewBox={`0 0 ${adapterGraphWidth} ${adapterGraphHeight}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full fill-none stroke-border-strong"
          >
            {frameworkAdapterConnections.map((connection, index) => (
              <path
                key={connection.label}
                d={connection.path}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={hasEntered ? 0 : 1}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                style={{ transitionDelay: `${index * 60}ms` }}
                className="transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
              />
            ))}
          </svg>

          {frameworkAdapterNodes.map((adapter) => (
            <span
              key={adapter.label}
              style={adapterGraphStyle(adapter)}
              className="absolute flex items-center justify-center rounded-md border border-border-default bg-background-surface px-2 text-center text-text-secondary"
            >
              {adapter.label}
            </span>
          ))}

          <span
            style={adapterGraphStyle(frameworkAdapterCore)}
            className="absolute flex items-center justify-center rounded-md bg-background-inverse text-center text-text-inverse"
          >
            core
          </span>
        </div>
      </div>
    </div>
  )
}

function PrincipleProof({ proof }: { proof: PrincipleProof }) {
  if (proof === 'adapters') {
    return <FrameworkAdapterGraph />
  }

  if (proof === 'types') {
    return (
      <div className="flex w-full flex-col gap-3 font-ds-mono text-ds-mono-md">
        {[
          ['params.postId', 'string'],
          ['query.data', 'Project[]'],
          ['form.email', 'Field<string>'],
        ].map(([name, value]) => (
          <div key={name} className="flex items-baseline justify-between gap-4">
            <span className="text-text-secondary">{name}</span>
            <span className="font-medium text-text-primary">{value}</span>
          </div>
        ))}
      </div>
    )
  }

  if (proof === 'adoption') {
    return <AdoptionProof />
  }

  return <IndependenceProof />
}

/**
 * Production-Grade proof: the live npm download odometer already prefetched by
 * the route loader. One real number rather than adjectives — the hero strip
 * carries the compact totals, so this panel shows only the full ticking count.
 */
function AdoptionProof() {
  const { data: summary } = useQuery(homepageNpmStatsSummaryQuery())
  const totalDownloads = summary?.totalDownloads ?? 0

  const counterRef = useNpmDownloadCounter({
    totalDownloads,
    ratePerDay: summary?.weeklyRatePerDay ?? 0,
  })

  return (
    <div className="flex w-full flex-col gap-2 font-ds-mono">
      <span className="text-ds-mono-caps uppercase text-text-muted">
        npm downloads, and counting
      </span>
      <span
        // The odometer writes into this node directly; only hand it over
        // once there is a real number for it to count from. npm can be slow,
        // rate-limited, or down — a literal 0 would claim no users.
        ref={totalDownloads > 0 ? counterRef : undefined}
        className="text-3xl font-medium tabular-nums text-text-primary sm:text-ds-heading-1"
      >
        {totalDownloads > 0 ? totalDownloads.toLocaleString() : '—'}
      </span>
    </div>
  )
}

/**
 * No Vendor Lock-in proof: four claims as a ledger so the panel reads as
 * substantiated rather than decorative.
 */
function IndependenceProof() {
  return (
    <dl className="flex w-full flex-col font-ds-mono">
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
            index > 0 && 'border-t border-border-default',
          )}
        >
          <dt className="text-ds-mono-caps uppercase text-text-muted">
            {term}
          </dt>
          <dd className="text-ds-mono-sm font-medium text-text-primary">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
