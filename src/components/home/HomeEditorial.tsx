import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import {
  ArrowRight,
  ArrowUpRight,
  Code2,
  Flame,
  Layers,
  Newspaper,
  Play,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react'

import { librariesByGroup, librariesGroupNamesMap, start } from '~/libraries'
import type { LibrarySlim } from '~/libraries'
import { groupToSlug } from '~/components/stack/stack-categories'
import { HomeApplicationStarter } from '~/components/home/HomeApplicationStarter'
import { HomeDeferredSection } from '~/components/home/HomeDeferredSection'
import { HomeStatsFallback } from '~/components/home/HomeSectionFallbacks'

const loadHomeStatsSection = () => import('~/components/home/HomeStatsSection')

const LazyHomeStatsSection = React.lazy(() =>
  loadHomeStatsSection().then((m) => ({
    default: m.HomeStatsSection,
  })),
)
import {
  partners,
  PartnerImage,
  partnerTierFlares,
  partnerTierLabels,
  type PartnerTier,
} from '~/utils/partners'
import { formatPublishedDate, getPublishedPosts } from '~/utils/blog'
import { TrustedByMarquee } from '~/components/TrustedByMarquee'
import { YouTubeIcon } from '~/components/icons/YouTubeIcon'
import { Button } from '~/ui'

import discordImage from '~/images/discord-logo-white.svg'

type GroupId = keyof typeof librariesByGroup

const GROUP_ORDER: GroupId[] = ['state', 'headlessUI', 'performance', 'tooling']

const LEADERBOARD_IDS = ['query', 'router', 'table', 'form'] as const

const TRUST_PILLARS = [
  {
    icon: Code2,
    title: 'Type-safe by design',
    detail: 'TypeScript-first APIs catch bugs before runtime.',
  },
  {
    icon: Layers,
    title: 'Framework-agnostic',
    detail: 'React, Vue, Solid, Svelte, Angular — your choice.',
  },
  {
    icon: ShieldCheck,
    title: 'Production-grade',
    detail: 'Battle-tested in the world’s largest apps.',
  },
  {
    icon: Shield,
    title: 'Open source forever',
    detail: 'MIT licensed. No vendor lock-in, ever.',
  },
] as const

export function HomeEditorial() {
  const featured = start
  const leaderboard = LEADERBOARD_IDS.map((id) => findLib(id)).filter(
    (lib): lib is LibrarySlim => Boolean(lib),
  )
  const latestPosts = getPublishedPosts().slice(0, 4)

  const partnersByTier = groupPartnersByTier()

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Hero: featured + leaderboard side rail */}
      <section className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-4 py-10 lg:py-14 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Eyebrow tone="accent">
              <Sparkles size={12} /> Featured stack
            </Eyebrow>
            <FeaturedStarterCard library={featured} />
          </div>

          <aside className="space-y-3">
            <Eyebrow>
              <TrendingUp size={12} /> Top libraries
            </Eyebrow>
            <ol className="space-y-2.5">
              {leaderboard.map((lib, i) => (
                <LeaderboardCard key={lib.id} library={lib} rank={i + 1} />
              ))}
            </ol>
            <Link
              to="/libraries"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              See all libraries <ArrowRight size={14} />
            </Link>
          </aside>
        </div>
      </section>

      {/* Trust pillars */}
      <section className="bg-white dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-4 py-8 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_PILLARS.map(({ icon: Icon, title, detail }) => (
            <div key={title} className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <Icon size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">{title}</p>
                <p className="mt-0.5 text-xs leading-snug text-zinc-600 dark:text-zinc-400">
                  {detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trusted-by marquee */}
      <section className="border-y border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <Eyebrow>
            <Star size={12} /> Trusted in production
          </Eyebrow>
          <div className="mt-3">
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
        </div>
      </section>

      {/* Live OSS stats — by the numbers */}
      <section className="bg-white dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <SectionHeader
            eyebrow={
              <>
                <TrendingUp size={12} /> By the numbers
              </>
            }
            title="Live across the TanStack ecosystem"
            description="Real-time NPM downloads, GitHub stars, contributors and dependents — refreshed continuously."
          />
          <HomeDeferredSection
            fallback={<HomeStatsFallback />}
            preload={loadHomeStatsSection}
            rootMargin="10%"
            timeoutMs={6000}
          >
            <LazyHomeStatsSection />
          </HomeDeferredSection>
        </div>
      </section>

      {/* Group leaderboards */}
      <section className="bg-white dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <SectionHeader
            eyebrow={
              <>
                <Flame size={12} /> Browse the stack
              </>
            }
            title="Top picks by category"
            action={
              <Link
                to="/libraries"
                className="text-sm font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white inline-flex items-center gap-1"
              >
                Full library index <ArrowRight size={14} />
              </Link>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {GROUP_ORDER.map((groupId) => (
              <GroupLeaderboardCard
                key={groupId}
                groupId={groupId}
                libraries={librariesByGroup[groupId]}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Latest writing */}
      {latestPosts.length > 0 && (
        <section className="border-y border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
          <div className="mx-auto max-w-7xl px-4 py-12">
            <SectionHeader
              eyebrow={
                <>
                  <Newspaper size={12} /> From the team
                </>
              }
              title="Latest writing"
              action={
                <Link
                  to="/blog"
                  className="text-sm font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white inline-flex items-center gap-1"
                >
                  Visit the blog <ArrowRight size={14} />
                </Link>
              }
            />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {latestPosts.map((post, i) => (
                <BlogCard key={post.slug} post={post} featured={i === 0} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Partners (the centerpiece) */}
      <section className="bg-white dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-4 py-14">
          <SectionHeader
            eyebrow={
              <>
                <Star size={12} /> From our industry
              </>
            }
            title="Trusted partners we recommend"
            description="The companies powering production TanStack apps — ranked by tier of commitment."
            action={
              <Link
                to="/partners"
                className="text-sm font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white inline-flex items-center gap-1"
              >
                All partners <ArrowRight size={14} />
              </Link>
            }
          />
          <div className="space-y-10">
            <TierBlock tier="gold" partners={partnersByTier.gold} />
            <TierBlock tier="silver" partners={partnersByTier.silver} />
            <TierBlock tier="bronze" partners={partnersByTier.bronze} />
          </div>
        </div>
      </section>

      {/* Community pair */}
      <section className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <SectionHeader
            eyebrow={
              <>
                <Sparkles size={12} /> Join the community
              </>
            }
            title="Get closer to the team"
          />
          <div className="grid gap-5 md:grid-cols-2">
            <CommunityCard
              href="https://discord.com/invite/WrRKjPJ"
              accent="bg-discord shadow-indigo-700/20"
              badge="Live chat"
              title="TanStack on Discord"
              copy="Ask questions, share builds, get release news first."
              cta="Join Discord"
              illustration={
                <img
                  src={discordImage}
                  alt=""
                  loading="lazy"
                  width={220}
                  height={220}
                  className="opacity-25"
                />
              }
            />
            <CommunityCard
              href="https://youtube.com/@tan_stack"
              accent="bg-gradient-to-br from-red-500 to-red-700 shadow-red-700/20"
              badge="Watch & learn"
              title="TanStack on YouTube"
              copy="Tutorials, deep dives, and release walkthroughs."
              cta={
                <>
                  <Play size={14} /> Subscribe
                </>
              }
              illustration={
                <YouTubeIcon width={220} height={220} className="opacity-25" />
              }
            />
          </div>
        </div>
      </section>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Building blocks                                                            */
/* -------------------------------------------------------------------------- */

function Eyebrow({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode
  tone?: 'muted' | 'accent'
}) {
  return (
    <p
      className={twMerge(
        'inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em]',
        tone === 'accent'
          ? 'text-cyan-600 dark:text-cyan-400'
          : 'text-zinc-500 dark:text-zinc-400',
      )}
    >
      {children}
    </p>
  )
}

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

function FeaturedStarterCard({ library }: { library: LibrarySlim }) {
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Brand header — gradient strip carrying Start identity */}
      <div
        className={twMerge(
          'relative overflow-hidden px-6 py-5 text-white sm:px-7',
          'bg-gradient-to-br',
          library.colorFrom,
          library.colorTo,
        )}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center rounded bg-white/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-white backdrop-blur">
            TanStack
          </span>
          <h3 className="text-2xl font-black leading-none sm:text-3xl">
            {library.name.replace('TanStack ', '')}
          </h3>
          {library.badge && (
            <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur">
              {library.badge}
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur">
            v{library.latestVersion}
          </span>
          <Link
            to={library.to ?? '#'}
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-white/90 hover:text-white"
          >
            Open Start <ArrowRight size={12} />
          </Link>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-white/95 sm:text-base">
          {library.tagline}
        </p>
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
      </div>

      {/* Interactive starter — pick a template, generate a prompt, deploy */}
      <div className="p-4 sm:p-6">
        <HomeApplicationStarter />
      </div>
    </div>
  )
}

function LeaderboardCard({
  library,
  rank,
}: {
  library: LibrarySlim
  rank: number
}) {
  return (
    <li>
      <Link
        to={library.to ?? '#'}
        className="group flex items-stretch gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
      >
        <div
          className={twMerge(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-2xl font-black text-white shadow-sm',
            library.colorFrom,
            library.colorTo,
          )}
        >
          {rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              TanStack
            </p>
            {library.badge && (
              <span
                className={twMerge(
                  'rounded px-1.5 py-px text-[9px] font-black uppercase tracking-wide text-white bg-gradient-to-r',
                  library.colorFrom,
                  library.colorTo,
                )}
              >
                {library.badge}
              </span>
            )}
          </div>
          <p className="text-sm font-bold leading-tight">
            {library.name.replace('TanStack ', '')}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-zinc-600 dark:text-zinc-400">
            {library.tagline}
          </p>
        </div>
        <ArrowRight
          size={14}
          className="mt-1 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:group-hover:text-white"
        />
      </Link>
    </li>
  )
}

function GroupLeaderboardCard({
  groupId,
  libraries,
}: {
  groupId: GroupId
  libraries: readonly LibrarySlim[]
}) {
  const topThree = libraries.slice(0, 3)
  const groupName = librariesGroupNamesMap[groupId]
  const categorySlug = groupToSlug[groupId]

  return (
    <Link
      to="/stack/$category"
      params={{ category: categorySlug }}
      className="group flex flex-col rounded-xl border border-zinc-200 bg-zinc-50/40 p-5 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:border-zinc-700"
    >
      <Eyebrow>{groupName}</Eyebrow>
      <h3 className="mt-1.5 text-base font-bold group-hover:underline">
        Top in {groupName.toLowerCase()}
      </h3>
      <ol className="mt-4 space-y-3">
        {topThree.map((lib, i) => (
          <li key={lib.id} className="flex items-start gap-3">
            <span
              className={twMerge(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-xs font-black text-white',
                lib.colorFrom,
                lib.colorTo,
              )}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight">
                {lib.name.replace('TanStack ', '')}
              </p>
              <p className="mt-0.5 line-clamp-1 text-xs text-zinc-600 dark:text-zinc-400">
                {lib.tagline}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
        Read the full guide
        <ArrowRight
          size={12}
          className="transition-transform group-hover:translate-x-0.5"
        />
      </span>
    </Link>
  )
}

function BlogCard({
  post,
  featured = false,
}: {
  post: { slug: string; title: string; published: string; excerpt?: string }
  featured?: boolean
}) {
  return (
    <Link
      to="/blog/$"
      params={{ _splat: post.slug }}
      className={twMerge(
        'group flex flex-col rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900',
        featured && 'sm:col-span-2 lg:col-span-2',
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        {formatPublishedDate(post.published)}
      </p>
      <h3
        className={twMerge(
          'mt-2 font-bold leading-snug group-hover:underline',
          featured ? 'text-xl sm:text-2xl' : 'text-base',
        )}
      >
        {post.title}
      </h3>
      {post.excerpt && (
        <p
          className={twMerge(
            'mt-2 text-sm text-zinc-600 dark:text-zinc-400',
            featured ? 'line-clamp-3' : 'line-clamp-2',
          )}
        >
          {post.excerpt}
        </p>
      )}
      <span className="mt-auto pt-4 inline-flex items-center gap-1 text-xs font-semibold text-cyan-600 dark:text-cyan-400">
        Read post <ArrowRight size={12} />
      </span>
    </Link>
  )
}

/* -------------------------------------------------------------------------- */
/* Partners                                                                   */
/* -------------------------------------------------------------------------- */

function TierBlock({
  tier,
  partners: tierPartners,
}: {
  tier: PartnerTier
  partners: Partner[]
}) {
  if (tierPartners.length === 0) return null
  const flare = partnerTierFlares[tier]
  const label = partnerTierLabels[tier]

  const gridClass =
    tier === 'gold'
      ? 'grid gap-4 sm:grid-cols-2'
      : tier === 'silver'
        ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
        : 'grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span
          className={twMerge(
            'inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br text-white shadow',
            flare.gradientStops,
          )}
        >
          {flare.icon}
        </span>
        <h3
          className={twMerge(
            'text-xs font-black uppercase tracking-[0.18em]',
            flare.labelColor,
          )}
        >
          {label} partners
        </h3>
        <span className="text-xs text-zinc-400 dark:text-zinc-600">
          · {tierPartners.length}
        </span>
      </div>
      <div className={gridClass}>
        {tierPartners.map((partner) => (
          <PartnerTile key={partner.id} partner={partner} tier={tier} />
        ))}
      </div>
    </div>
  )
}

function PartnerTile({
  partner,
  tier,
}: {
  partner: Partner
  tier: PartnerTier
}) {
  const sizing =
    tier === 'gold'
      ? 'p-6 min-h-[140px]'
      : tier === 'silver'
        ? 'p-5 min-h-[110px]'
        : 'p-4 min-h-[88px]'

  const logoSize =
    tier === 'gold'
      ? 'max-w-[180px]'
      : tier === 'silver'
        ? 'max-w-[140px]'
        : 'max-w-[110px]'

  return (
    <a
      href={partner.href}
      target="_blank"
      rel="noopener noreferrer"
      className={twMerge(
        'group relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-zinc-200 bg-white text-center transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700',
        sizing,
      )}
    >
      <div className={twMerge('w-full', logoSize)}>
        <PartnerImage config={partner.image} alt={partner.name} />
      </div>
      {partner.tagline && tier !== 'bronze' && (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          {partner.tagline}
        </p>
      )}
      <ArrowUpRight
        size={14}
        className="absolute right-3 top-3 text-zinc-300 transition-colors group-hover:text-zinc-700 dark:text-zinc-700 dark:group-hover:text-zinc-200"
      />
    </a>
  )
}

type Partner = (typeof partners)[number]

function groupPartnersByTier(): Record<PartnerTier, Partner[]> {
  const result: Record<PartnerTier, Partner[]> = {
    gold: [],
    silver: [],
    bronze: [],
  }
  for (const partner of partners) {
    if (partner.status === 'inactive') continue
    if (!partner.tier) continue
    result[partner.tier].push(partner)
  }
  for (const tier of Object.keys(result) as PartnerTier[]) {
    result[tier].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  }
  return result
}

/* -------------------------------------------------------------------------- */
/* Community CTAs                                                             */
/* -------------------------------------------------------------------------- */

function CommunityCard({
  href,
  accent,
  badge,
  title,
  copy,
  cta,
  illustration,
}: {
  href: string
  accent: string
  badge: string
  title: string
  copy: string
  cta: React.ReactNode
  illustration: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={twMerge(
        'group relative flex items-center justify-between gap-4 overflow-hidden rounded-xl p-6 text-white shadow-lg sm:p-7',
        accent,
      )}
    >
      <div className="relative z-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">
          {badge}
        </p>
        <h3 className="mt-1 text-xl font-black sm:text-2xl">{title}</h3>
        <p className="mt-1 max-w-md text-sm text-white/90">{copy}</p>
        <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-zinc-900 shadow-sm transition-colors group-hover:bg-zinc-100">
          {cta}
        </span>
      </div>
      <div className="pointer-events-none absolute -right-6 -top-6 hidden sm:block">
        {illustration}
      </div>
    </a>
  )
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function findLib(id: string): LibrarySlim | undefined {
  for (const group of Object.values(librariesByGroup)) {
    const hit = group.find((l) => l.id === id)
    if (hit) return hit
  }
  return undefined
}
