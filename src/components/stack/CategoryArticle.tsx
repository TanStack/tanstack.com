import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronRight,
  Layers,
  Newspaper,
  Sparkles,
} from 'lucide-react'
import { GitHub } from '~/ui'

import type { LibrarySlim } from '~/libraries'
import { formatPublishedDate, getPostsForLibrary } from '~/utils/blog'
import {
  categoryMeta,
  getCategoryLibraries,
  getOtherCategories,
  type CategorySlug,
} from './stack-categories'

export function CategoryArticle({ slug }: { slug: CategorySlug }) {
  const meta = categoryMeta[slug]
  const libraries = getCategoryLibraries(slug)
  const editorsPick =
    libraries.find((lib) => lib.id === meta.editorsPickId) ?? libraries[0]
  const runners = libraries.filter((lib) => lib.id !== editorsPick.id)
  const others = getOtherCategories(slug)
  const relatedPosts = libraries
    .flatMap((lib) => getPostsForLibrary(lib.id).map((p) => ({ post: p, lib })))
    .slice(0, 4)

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Breadcrumb strip */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-4 py-2.5 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 flex-wrap">
          <Link to="/" className="hover:text-zinc-900 dark:hover:text-white">
            Home
          </Link>
          <ChevronRight size={12} />
          <Link
            to="/libraries"
            className="hover:text-zinc-900 dark:hover:text-white"
          >
            Stack
          </Link>
          <ChevronRight size={12} />
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
            {meta.name}
          </span>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-7xl px-4 py-10 lg:py-14">
          <p
            className={twMerge(
              'inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em]',
              meta.accent.text,
            )}
          >
            <Sparkles size={12} /> Stack buyer’s guide · {meta.shortName}
          </p>
          <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            {meta.headline}
          </h1>
          <p className="mt-4 max-w-3xl text-base text-zinc-600 dark:text-zinc-400 sm:text-lg">
            {meta.intro}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            <span>Updated · May 2026</span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span>{libraries.length} libraries reviewed</span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span>Independent · MIT licensed</span>
          </div>
        </div>
      </section>

      {/* Article body — 2 col with sticky rail */}
      <div className="mx-auto max-w-7xl px-4 py-10 lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-12">
        <article className="space-y-14 min-w-0">
          <EditorsPickBlock library={editorsPick} accent={meta.accent} />

          <QuickVerdictBlock libraries={libraries} accent={meta.accent} />

          <RankedListBlock
            libraries={libraries}
            editorsPickId={editorsPick.id}
            accent={meta.accent}
          />

          <CriteriaBlock meta={meta} />

          {relatedPosts.length > 0 && (
            <RelatedPostsBlock items={relatedPosts} />
          )}
        </article>

        <aside className="mt-12 lg:mt-0">
          <div className="lg:sticky lg:top-6 space-y-6">
            <TocBlock libraries={libraries} editorsPickId={editorsPick.id} />
            <OtherCategoriesBlock others={others} />
            <FullIndexCta />
          </div>
        </aside>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Hero / Editor’s pick                                                       */
/* -------------------------------------------------------------------------- */

function EditorsPickBlock({
  library,
  accent,
}: {
  library: LibrarySlim
  accent: { from: string; to: string }
}) {
  return (
    <section id={library.id} className="scroll-mt-6">
      <SectionEyebrow>
        <Award size={12} /> Top pick
      </SectionEyebrow>
      <h2 className="mt-2 text-2xl font-black sm:text-3xl">
        The one we start with: {library.name}
      </h2>
      <Link
        to={library.to ?? '#'}
        className={twMerge(
          'group mt-5 block overflow-hidden rounded-2xl text-white shadow-xl transition-transform hover:-translate-y-0.5',
          'bg-gradient-to-br',
          library.colorFrom,
          library.colorTo,
        )}
      >
        <div className="relative grid gap-6 p-7 sm:p-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {library.badge && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur">
                  {library.badge}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur">
                v{library.latestVersion}
              </span>
            </div>
            <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
              TanStack
            </p>
            <h3 className="mt-1 text-3xl font-black leading-tight sm:text-4xl">
              {library.name.replace('TanStack ', '')}
            </h3>
            <p className="mt-3 max-w-xl text-base text-white/95 sm:text-lg">
              {library.tagline}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-zinc-900 shadow-sm group-hover:bg-zinc-100">
              Read the full review <ArrowRight size={14} />
            </span>
          </div>
          <div className="pointer-events-none absolute -bottom-32 -right-24 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
        </div>
        <div className="border-t border-white/15 bg-black/15 px-7 py-4 text-sm leading-relaxed text-white/95 sm:px-10">
          {library.description}
        </div>
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {library.frameworks.slice(0, 6).map((fw) => (
          <FrameworkChip key={fw} label={fw} />
        ))}
        {library.frameworks.length > 6 && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            + {library.frameworks.length - 6} more frameworks
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          <GitHub className="h-3.5 w-3.5" /> tanstack/
          {library.repo?.split('/').pop()}
        </span>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Quick verdicts table                                                       */
/* -------------------------------------------------------------------------- */

function QuickVerdictBlock({
  libraries,
  accent,
}: {
  libraries: LibrarySlim[]
  accent: { from: string; to: string }
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
      <SectionEyebrow>
        <CheckCircle2 size={12} /> Quick verdict
      </SectionEyebrow>
      <h2 className="mt-2 text-xl font-black sm:text-2xl">
        At-a-glance — which one is for you?
      </h2>
      <ul className="mt-5 divide-y divide-zinc-200 dark:divide-zinc-800">
        {libraries.map((lib) => (
          <li
            key={lib.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm"
          >
            <span
              className={twMerge(
                'inline-flex h-7 min-w-[60px] items-center justify-center rounded-md bg-gradient-to-br px-2 text-[10px] font-black uppercase tracking-widest text-white',
                lib.colorFrom,
                lib.colorTo,
              )}
            >
              {lib.name.replace('TanStack ', '')}
            </span>
            <span className="flex-1 min-w-[200px] text-zinc-700 dark:text-zinc-300">
              {lib.tagline}
            </span>
            <Link
              to={lib.to ?? '#'}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white inline-flex items-center gap-1"
            >
              Open <ArrowRight size={12} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Ranked list (deep dive per library)                                        */
/* -------------------------------------------------------------------------- */

function RankedListBlock({
  libraries,
  editorsPickId,
  accent,
}: {
  libraries: LibrarySlim[]
  editorsPickId: string
  accent: { from: string; to: string }
}) {
  return (
    <section>
      <SectionEyebrow>
        <Layers size={12} /> Ranked: each one in detail
      </SectionEyebrow>
      <h2 className="mt-2 text-2xl font-black sm:text-3xl">
        Every library in this category, reviewed
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Numbered in the order we’d try them. Click into any library for the full
        landing page, docs, examples and version history.
      </p>
      <ol className="mt-6 space-y-4">
        {libraries.map((lib, i) => (
          <RankedEntry
            key={lib.id}
            library={lib}
            rank={i + 1}
            isEditorsPick={lib.id === editorsPickId}
          />
        ))}
      </ol>
    </section>
  )
}

function RankedEntry({
  library,
  rank,
  isEditorsPick,
}: {
  library: LibrarySlim
  rank: number
  isEditorsPick: boolean
}) {
  return (
    <li
      id={library.id}
      className="scroll-mt-6 rounded-xl border border-zinc-200 bg-white p-6 transition-shadow hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex gap-4">
        <div
          className={twMerge(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-xl font-black text-white shadow-sm',
            library.colorFrom,
            library.colorTo,
          )}
        >
          {rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              TanStack
            </p>
            <h3 className="text-lg font-bold leading-tight">
              {library.name.replace('TanStack ', '')}
            </h3>
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
            {isEditorsPick && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                <Award size={10} /> Top pick
              </span>
            )}
          </div>
          <p className="mt-1 text-sm italic text-zinc-600 dark:text-zinc-400">
            {library.tagline}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {library.description}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {library.frameworks.slice(0, 5).map((fw) => (
              <FrameworkChip key={fw} label={fw} />
            ))}
            {library.frameworks.length > 5 && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                + {library.frameworks.length - 5} more
              </span>
            )}
            <Link
              to={library.to ?? '#'}
              className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
            >
              Open {library.name.replace('TanStack ', '')}{' '}
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </li>
  )
}

/* -------------------------------------------------------------------------- */
/* Criteria                                                                   */
/* -------------------------------------------------------------------------- */

function CriteriaBlock({
  meta,
}: {
  meta: { criteria: Array<{ title: string; detail: string }> }
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-6 dark:border-zinc-800 dark:bg-zinc-950/60 sm:p-8">
      <SectionEyebrow>
        <CheckCircle2 size={12} /> How we think about it
      </SectionEyebrow>
      <h2 className="mt-2 text-xl font-black sm:text-2xl">
        What a library in this category has to earn
      </h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        {meta.criteria.map((c) => (
          <div key={c.title}>
            <p className="text-sm font-bold leading-tight">{c.title}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {c.detail}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Related posts                                                              */
/* -------------------------------------------------------------------------- */

function RelatedPostsBlock({
  items,
}: {
  items: Array<{
    post: { slug: string; title: string; published: string; excerpt?: string }
    lib: LibrarySlim
  }>
}) {
  return (
    <section>
      <SectionEyebrow>
        <Newspaper size={12} /> From the team
      </SectionEyebrow>
      <h2 className="mt-2 text-xl font-black sm:text-2xl">
        Recent writing tagged with this category
      </h2>
      <ul className="mt-5 space-y-3">
        {items.map(({ post, lib }) => (
          <li key={post.slug}>
            <Link
              to="/blog/$"
              params={{ _splat: post.slug }}
              className="group flex items-start gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span
                className={twMerge(
                  'mt-0.5 inline-flex h-6 items-center rounded-md bg-gradient-to-br px-2 text-[10px] font-black uppercase tracking-widest text-white shrink-0',
                  lib.colorFrom,
                  lib.colorTo,
                )}
              >
                {lib.name.replace('TanStack ', '')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-snug group-hover:underline">
                  {post.title}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  {formatPublishedDate(post.published)}
                </p>
              </div>
              <ArrowRight
                size={14}
                className="mt-1 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:group-hover:text-white"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Side rail                                                                  */
/* -------------------------------------------------------------------------- */

function TocBlock({
  libraries,
  editorsPickId,
}: {
  libraries: LibrarySlim[]
  editorsPickId: string
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        In this guide
      </p>
      <ol className="mt-3 space-y-2 text-sm">
        {libraries.map((lib, i) => (
          <li key={lib.id}>
            <a
              href={`#${lib.id}`}
              className="group flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
            >
              <span
                className={twMerge(
                  'inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br text-[10px] font-black text-white shrink-0',
                  lib.colorFrom,
                  lib.colorTo,
                )}
              >
                {i + 1}
              </span>
              <span className="flex-1 truncate group-hover:underline">
                {lib.name.replace('TanStack ', '')}
              </span>
              {lib.id === editorsPickId && (
                <Award size={12} className="text-amber-500" />
              )}
            </a>
          </li>
        ))}
      </ol>
    </div>
  )
}

function OtherCategoriesBlock({
  others,
}: {
  others: Array<{ slug: CategorySlug; shortName: string; name: string }>
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        Compare across the stack
      </p>
      <ul className="mt-3 space-y-1 text-sm">
        {others.map((c) => (
          <li key={c.slug}>
            <Link
              to="/stack/$category"
              params={{ category: c.slug }}
              className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              <span className="font-semibold">{c.shortName}</span>
              <ChevronRight
                size={14}
                className="text-zinc-400 transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FullIndexCta() {
  return (
    <Link
      to="/libraries"
      className="group flex items-center justify-between gap-3 rounded-xl border border-zinc-300 bg-zinc-50 p-4 text-sm font-semibold text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
    >
      <span>
        <ArrowLeft size={14} className="inline -mt-0.5 mr-1 text-zinc-400" />
        See every TanStack library
      </span>
      <ArrowRight
        size={14}
        className="text-zinc-400 transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  )
}

/* -------------------------------------------------------------------------- */
/* Atoms                                                                      */
/* -------------------------------------------------------------------------- */

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
      {children}
    </p>
  )
}

function FrameworkChip({ label }: { label: string }) {
  return (
    <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {label}
    </span>
  )
}
