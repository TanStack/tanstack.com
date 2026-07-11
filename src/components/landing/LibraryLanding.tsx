import * as React from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { ArrowRight, BookOpen } from '@phosphor-icons/react'

import { BottomCTA } from '~/components/BottomCTA'
import { Footer } from '~/components/Footer'
import { GithubIcon } from '~/components/icons/GithubIcon'
import LandingPageGad from '~/components/LandingPageGad'
import { LandingCommunitySection } from '~/components/LandingCommunitySection'
import { SponsorSection } from '~/components/SponsorSection'
import { LibraryDownloadsMicro } from '~/components/LibraryDownloadsMicro'
import { LibraryTestimonials } from '~/components/LibraryTestimonials'
import { LibraryWordmark } from '~/components/LibraryWordmark'
import { LandingCopyPromptButton } from '~/components/landing/LandingCopyPromptButton'
import { Eyebrow } from '~/components/ds/ui'
import { getLibrary } from '~/libraries'
import type { LibraryId, Testimonial } from '~/libraries/types'

/**
 * Shared, config-driven landing page for every TanStack library.
 *
 * The page structure is identical across libraries; only the copy, the
 * interactive demo panels, and a small brand accent change. Pass those in via
 * `LibraryLandingConfig` and let this component own the scaffold, spacing,
 * neutral theme, and de-noised defaults (one CTA, no superlatives).
 */

type Kicker = { icon: React.ReactNode; text: string }

/**
 * The handful of spots where a library's brand color shows through. Everything
 * else stays neutral zinc so the page reads calm and consistent. Defaults to a
 * neutral accent when omitted.
 */
export type LandingAccent = {
  /** Kicker eyebrow text color. */
  kicker: string
  /** Feature-card / step icon chip background + text. */
  chip: string
  /** Proof-pill left border. */
  pill: string
  /** Bottom CTA button colors. */
  cta: string
}

const NEUTRAL_ACCENT: LandingAccent = {
  kicker: 'text-zinc-700 dark:text-zinc-300',
  chip: 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950',
  pill: 'border-zinc-950 dark:border-white',
  cta: 'border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800 dark:border-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200',
}

export type LibraryFeature = {
  title: string
  body: string
  icon: React.ReactNode
}

export type LibrarySplitSection = {
  kicker: Kicker
  heading: string
  body: string
  /** The bespoke demo/illustration panel — the one truly per-library asset. */
  panel: React.ReactNode
  /** Which side the panel sits on at lg+. Defaults to `right`. */
  side?: 'left' | 'right'
  /** Optional content rendered under the body (e.g. framework pills). */
  belowBody?: React.ReactNode
}

export type LibraryLandingConfig = {
  libraryId: LibraryId
  accent?: LandingAccent
  hero: {
    kicker: Kicker
    /** Bold one-liner. Keep it plain — no superlatives, no exclamations. */
    tagline: string
    description: string
    /** Agent prompt for the "Copy prompt" button. */
    prompt: string
    promptLabel: string
    proof: Array<{ label: string; value: string }>
    panel: React.ReactNode
    /** Optional block under the proof pills (e.g. ecosystem proof strip). */
    belowProof?: React.ReactNode
  }
  why: {
    kicker: Kicker
    heading: string
    intro: string
    features: Array<LibraryFeature>
  }
  sections: Array<LibrarySplitSection>
  /** Optional full-bleed block rendered after the split sections. */
  interlude?: React.ReactNode
  testimonials?: {
    kicker: Kicker
    heading: string
    body: string
    items: Array<Testimonial>
  }
  ecosystem: {
    kicker?: Kicker
    heading: string
    body: string
    /** Optional extra block inside the ecosystem section (e.g. a banner). */
    extra?: React.ReactNode
  }
}

// Horizontal gutter: 32px minimum, flexing up to 40px at sm+, so section
// content never sits closer than 32px to the viewport edge.
const SHELL = 'mx-auto w-full max-w-[80rem] px-6 sm:px-10 xl:max-w-[92rem]'
const GRID =
  'mx-auto grid w-full min-w-0 max-w-full gap-10 px-8 py-16 sm:px-10 lg:max-w-[80rem] xl:max-w-[92rem]'

export function LibraryLanding({ config }: { config: LibraryLandingConfig }) {
  const { libraryId, hero, why, sections, interlude, testimonials, ecosystem } =
    config
  const accent = config.accent ?? NEUTRAL_ACCENT
  const library = getLibrary(libraryId)
  const { version } = useParams({ strict: false })
  const resolvedVersion = version ?? library.latestVersion

  return (
    <div className="w-full min-w-0 overflow-x-hidden bg-zinc-100 text-zinc-950 dark:bg-zinc-950 dark:text-white">
      {/* Hero */}
      <section className="max-w-full overflow-hidden border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
        <div className="mx-auto grid w-full min-w-0 max-w-full gap-10 px-8 py-13 sm:px-10 lg:max-w-[80rem] lg:grid-cols-[0.86fr_1.14fr] lg:items-start lg:py-16 xl:max-w-[92rem]">
          <div className="min-w-0 max-w-full sm:max-w-3xl">
            <SectionKicker accent={accent} {...hero.kicker} />

            {/* Small TanStack mark stacked over a large, dominant product name.
                The mark stays understated — the navbar already carries the brand;
                here the library is the headline. */}
            <div className="mt-4">
              <img
                src="/images/brand/tanstack-landscape-black.svg"
                alt="TanStack"
                className="h-5 w-auto dark:hidden sm:h-6"
              />
              <img
                src="/images/brand/tanstack-landscape-white.svg"
                alt="TanStack"
                aria-hidden="true"
                className="hidden h-5 w-auto dark:block sm:h-6"
              />
              <h1 className="mt-0.5 text-6xl leading-[0.9] sm:text-7xl lg:text-8xl">
                <LibraryWordmark library={library} includeTanStack={false} />
              </h1>
            </div>

            <p className="mt-5 max-w-2xl text-ds-heading-4 text-zinc-900 dark:text-zinc-100">
              {hero.tagline}
            </p>

            <p className="mt-4 max-w-2xl text-ds-body-lg text-zinc-700 dark:text-zinc-300">
              {hero.description}
            </p>

            <LibraryDownloadsMicro
              animateIncreaseTrend
              library={library}
              className="mt-5"
              label="weekly downloads"
              period="weekly"
              showTotals
            />

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <PrimaryLink
                to="/$libraryId/$version/docs"
                params={{ libraryId: library.id, version: resolvedVersion }}
                label="Read the docs"
                icon={<BookOpen size={16} aria-hidden="true" />}
              />
              <LandingCopyPromptButton
                prompt={hero.prompt}
                label={hero.promptLabel}
              />
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {hero.proof.map((proof) => (
                <ProofPill key={proof.label} accent={accent} {...proof} />
              ))}
            </div>

            {hero.belowProof}
          </div>

          {hero.panel}
        </div>
      </section>

      {/* Why <library> */}
      <section className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto grid w-full min-w-0 max-w-full gap-10 px-8 py-16 sm:px-10 lg:max-w-[80rem] lg:grid-cols-[0.74fr_1.26fr] xl:max-w-[92rem]">
          <div>
            <SectionKicker accent={accent} {...why.kicker} />
            <h2 className="mt-3 max-w-xl text-ds-heading-1">{why.heading}</h2>
            <p className="mt-4 max-w-xl text-ds-body-lg text-zinc-700 dark:text-zinc-300">
              {why.intro}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {why.features.map((feature) => (
              <FeatureCard key={feature.title} accent={accent} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Split feature sections */}
      {sections.map((section, index) => (
        <SplitSection
          key={section.heading}
          accent={accent}
          section={section}
          alt={index % 2 === 0}
        />
      ))}

      {interlude}

      {/* Testimonials */}
      {testimonials ? (
        <section className="border-b border-zinc-200 bg-zinc-50 py-16 dark:border-zinc-800 dark:bg-zinc-900">
          <div className={SHELL}>
            <div className="max-w-3xl">
              <SectionKicker accent={accent} {...testimonials.kicker} />
              <h2 className="mt-3 text-ds-heading-1">{testimonials.heading}</h2>
              <p className="mt-4 text-ds-body-lg text-zinc-700 dark:text-zinc-300">
                {testimonials.body}
              </p>
            </div>
          </div>
          <div className="mt-8">
            <LibraryTestimonials testimonials={testimonials.items} />
          </div>
        </section>
      ) : null}

      {/* Open source ecosystem */}
      <section className="bg-white py-16 dark:bg-zinc-950">
        <div className={SHELL}>
          <div className="max-w-3xl">
            <SectionKicker
              accent={accent}
              icon={
                ecosystem.kicker?.icon ?? <GithubIcon className="h-4 w-4" />
              }
              text={ecosystem.kicker?.text ?? 'Open source ecosystem'}
            />
            <h2 className="mt-3 text-ds-heading-1">{ecosystem.heading}</h2>
            <p className="mt-4 text-ds-body-lg text-zinc-700 dark:text-zinc-300">
              {ecosystem.body}
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-14">
          <LandingCommunitySection libraryId={libraryId} />
          {ecosystem.extra}
          <SponsorSection
            title="GitHub Sponsors"
            aspectRatio="1/1"
            packMaxWidth="900px"
            showCTA
          />
        </div>
      </section>

      <LandingPageGad />
      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id, version: resolvedVersion },
        }}
        label="Get started"
        className={accent.cta}
      />
      <Footer />
    </div>
  )
}

function SplitSection({
  accent,
  alt,
  section,
}: {
  accent: LandingAccent
  alt: boolean
  section: LibrarySplitSection
}) {
  const panelLeft = section.side === 'left'
  const cols = panelLeft
    ? 'lg:grid-cols-[1.08fr_0.92fr]'
    : 'lg:grid-cols-[0.82fr_1.18fr]'
  const text = (
    <div className="max-w-xl">
      <SectionKicker accent={accent} {...section.kicker} />
      <h2 className="mt-3 text-ds-heading-1">{section.heading}</h2>
      <p className="mt-4 text-ds-body-lg text-zinc-700 dark:text-zinc-300">
        {section.body}
      </p>
      {section.belowBody}
    </div>
  )

  return (
    <section
      className={`border-b border-zinc-200 dark:border-zinc-800 ${
        alt ? 'bg-white dark:bg-zinc-950' : 'bg-zinc-50 dark:bg-zinc-900'
      }`}
    >
      <div className={`${GRID} ${cols} lg:items-center`}>
        {panelLeft ? (
          <>
            {section.panel}
            {text}
          </>
        ) : (
          <>
            {text}
            {section.panel}
          </>
        )}
      </div>
    </section>
  )
}

// Thin adapter over the DS <Eyebrow>: maps the template's {icon, text} + brand
// accent onto the shared component so every library page renders the same
// on-system eyebrow. Brand color rides in via className until the color pass
// moves accents onto DS tokens.
function SectionKicker({
  accent,
  icon,
  text,
}: {
  accent: LandingAccent
  icon: React.ReactNode
  text: React.ReactNode
}) {
  return (
    <Eyebrow icon={icon} className={accent.kicker}>
      {text}
    </Eyebrow>
  )
}

function FeatureCard({
  accent,
  body,
  icon,
  title,
}: LibraryFeature & { accent: LandingAccent }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent.chip}`}
      >
        {icon}
      </span>
      <h3 className="mt-4 text-ds-heading-4">{title}</h3>
      <p className="mt-3 text-ds-body-sm text-zinc-700 dark:text-zinc-300">
        {body}
      </p>
    </div>
  )
}

function ProofPill({
  accent,
  label,
  value,
}: {
  accent: LandingAccent
  label: string
  value: string
}) {
  return (
    <div className={`border-l-2 pl-3 ${accent.pill}`}>
      <p className="text-ds-label-md text-zinc-950 dark:text-white">{label}</p>
      <p className="mt-1 text-ds-body-sm text-zinc-600 dark:text-zinc-400">
        {value}
      </p>
    </div>
  )
}

function PrimaryLink({
  icon,
  label,
  params,
  to,
}: {
  icon: React.ReactNode
  label: string
  params: Record<string, string>
  to: string
}) {
  return (
    <Link
      to={to}
      params={params}
      className="inline-flex w-full max-w-full items-center justify-center gap-2 rounded-lg border border-zinc-950 bg-zinc-950 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-zinc-800 dark:border-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 sm:w-auto"
    >
      {icon}
      {label}
      <ArrowRight size={15} aria-hidden="true" />
    </Link>
  )
}
