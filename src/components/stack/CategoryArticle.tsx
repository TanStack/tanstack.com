import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import {
  ArrowRight,
  Award,
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
  type CategorySlug,
} from './stack-categories'

export function CategoryArticle({ slug }: { slug: CategorySlug }) {
  const meta = categoryMeta[slug]
  const libraries = getCategoryLibraries(slug)
  const topPick =
    libraries.find((lib) => lib.id === meta.topPickId) ?? libraries[0]
  const relatedPosts = libraries
    .flatMap((lib) => getPostsForLibrary(lib.id).map((p) => ({ post: p, lib })))
    .slice(0, 4)

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Breadcrumb */}
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
            Libraries
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
            <Sparkles size={12} /> {meta.shortName}
          </p>
          <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            {meta.headline}
          </h1>
          <p className="mt-4 max-w-3xl text-base text-zinc-600 dark:text-zinc-400 sm:text-lg">
            {meta.intro}
          </p>
        </div>
      </section>

      {/* Body */}
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="space-y-14">
          <TopPickBlock library={topPick} />
          <FullListBlock libraries={libraries} topPickId={topPick.id} />
          {relatedPosts.length > 0 && (
            <RelatedPostsBlock items={relatedPosts} />
          )}
        </div>
      </div>
    </div>
  )
}

function TopPickBlock({ library }: { library: LibrarySlim }) {
  return (
    <section id={library.id} className="scroll-mt-6">
      <SectionEyebrow>
        <Award size={12} /> Where to start
      </SectionEyebrow>
      <h2 className="mt-2 text-2xl font-black sm:text-3xl">
        Start with {library.name}
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
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
              TanStack
            </p>
            <h3 className="mt-1 text-3xl font-black leading-tight sm:text-4xl">
              {library.name.replace('TanStack ', '')}
            </h3>
            <p className="mt-3 max-w-xl text-base text-white/95 sm:text-lg">
              {library.tagline}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-white px-4 py-2 text-sm font-bold text-zinc-900 shadow-sm group-hover:bg-zinc-100 md:self-end">
            Open the library <ArrowRight size={14} />
          </span>
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

function FullListBlock({
  libraries,
  topPickId,
}: {
  libraries: LibrarySlim[]
  topPickId: string
}) {
  return (
    <section>
      <SectionEyebrow>
        <Layers size={12} /> The full list
      </SectionEyebrow>
      <h2 className="mt-2 text-2xl font-black sm:text-3xl">
        Every library in this category
      </h2>
      <ol className="mt-6 space-y-4">
        {libraries.map((lib, i) => (
          <LibraryEntry
            key={lib.id}
            library={lib}
            rank={i + 1}
            isTopPick={lib.id === topPickId}
          />
        ))}
      </ol>
    </section>
  )
}

function LibraryEntry({
  library,
  rank,
  isTopPick,
}: {
  library: LibrarySlim
  rank: number
  isTopPick: boolean
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
            {isTopPick && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                <Award size={10} /> Where to start
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
