import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowUpRight, GitFork, Search, Star } from 'lucide-react'
import {
  kodyCommunityDetailSchema,
  kodyCommunitySearchSchema,
  type KodyCommunityListing,
} from '../core/kody-community'
import { useWorkspaceApi } from './WorkspaceApi'
import { MessageMarkdown } from './MessageMarkdown'
import { Button } from './ui/Button'
import { LoadingState } from './ui/LoadingState'
import { PackageIdentity, packageName } from './PackageIdentity'

const categories = [
  '',
  'integrations',
  'examples',
  'productivity',
  'apps',
  'utilities',
  'other',
]
export function KodyCommunity({
  accountScope,
  installedNames = [],
}: {
  accountScope: string
  installedNames?: string[]
}) {
  const { request, workspaceId } = useWorkspaceApi()
  const client = useQueryClient()
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<'best' | 'newest'>('best')
  const [selected, setSelected] = useState<KodyCommunityListing | null>(null)
  const search = useQuery({
    queryKey: [
      'kody-community-search',
      workspaceId,
      accountScope,
      query,
      category,
      sort,
    ],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ query, sort })
      if (category) params.set('category', category)
      return kodyCommunitySearchSchema.parse(
        await request(`kody/community?${params}`, undefined, 'GET', { signal }),
      )
    },
    staleTime: 60_000,
    retry: false,
  })
  const detailOptions = (item: KodyCommunityListing | null) => ({
    queryKey: [
      'kody-community-detail',
      workspaceId,
      accountScope,
      item?.listingId,
    ],
    queryFn: async ({ signal }: { signal: AbortSignal }) =>
      kodyCommunityDetailSchema.parse(
        await request(`kody/community/${item!.listingId}`, undefined, 'GET', {
          signal,
        }),
      ),
    staleTime: 60_000,
    retry: false as const,
  })
  const detail = useQuery({ ...detailOptions(selected), enabled: !!selected })
  function submit(event: FormEvent) {
    event.preventDefault()
    if (draft.trim() === query) void search.refetch()
    else setQuery(draft.trim())
  }
  if (selected)
    return (
      <article className="package-detail-page">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
          <ArrowLeft size={15} />
          All packages
        </Button>
        <header className="package-detail-heading">
          <PackageIdentity name={selected.name} iconUrl={selected.iconUrl} />
          <div>
            <h2>{packageName(selected.name).title}</h2>
            <span className="home-muted">
              {packageName(selected.name).owner}
            </span>
          </div>
          <a
            className="package-external"
            href={selected.publicUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open in Kody
            <ArrowUpRight size={16} />
          </a>
        </header>
        <p className="package-description">{selected.description}</p>
        <PackageMetadata
          item={selected}
          installed={installedNames.includes(selected.name)}
        />
        {detail.isPending && (
          <LoadingState inset>Loading package details…</LoadingState>
        )}
        {detail.isError && (
          <div role="alert">
            <p>Package details could not be loaded.</p>
            <Button variant="secondary" onClick={() => void detail.refetch()}>
              Try again
            </Button>
          </div>
        )}
        {detail.data && (
          <div className="package-readme">
            {detail.data.status === 'delisted' && (
              <p role="status">This package is no longer listed in Kody.</p>
            )}
            <MessageMarkdown httpsLinksOnly>
              {detail.data.readme}
            </MessageMarkdown>
          </div>
        )}
      </article>
    )
  return (
    <div className="package-browser">
      <h2>Kody Marketplace</h2>
      <form className="package-search" onSubmit={submit}>
        <Search size={18} aria-hidden />
        <input
          aria-label="Search Kody packages"
          placeholder="Search packages, tools, and services"
          maxLength={200}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" size="sm">
          Search
        </Button>
      </form>
      <div
        className="package-categories"
        role="group"
        aria-label="Package category"
      >
        {categories.map((id) => (
          <Button
            key={id}
            size="sm"
            variant={category === id ? 'secondary' : 'ghost'}
            aria-pressed={category === id}
            onClick={() => setCategory(id)}
          >
            {id ? id.charAt(0).toUpperCase() + id.slice(1) : 'All'}
          </Button>
        ))}
      </div>
      <div className="package-sort" role="group" aria-label="Sort packages">
        {(['best', 'newest'] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={sort === value ? 'secondary' : 'ghost'}
            aria-pressed={sort === value}
            onClick={() => setSort(value)}
          >
            {categoryLabel(value)}
          </Button>
        ))}
      </div>
      {search.isPending && <LoadingState inset>Loading packages…</LoadingState>}
      {search.isError && (
        <div role="alert">
          <p>Packages could not be loaded.</p>
          <Button variant="secondary" onClick={() => void search.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {(category || query
        ? [category || 'results']
        : categories.filter(Boolean)
      ).map((group) => {
        const items =
          search.data?.items.filter(
            (item) => category || query || item.category === group,
          ) ?? []
        if (!items.length) return null
        return (
          <section className="package-category-section" key={group}>
            {!category && !query && (
              <header>
                <h2>{categoryLabel(group)}</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCategory(group)}
                >
                  See all {group}
                  <ArrowUpRight size={14} />
                </Button>
              </header>
            )}
            <div className="package-grid">
              {items.map((item) => (
                <button
                  key={item.listingId}
                  className="package-tile"
                  onClick={() => setSelected(item)}
                  onMouseEnter={() =>
                    void client.prefetchQuery(detailOptions(item))
                  }
                  onFocus={() => void client.prefetchQuery(detailOptions(item))}
                >
                  <PackageIdentity name={item.name} iconUrl={item.iconUrl} />
                  <span className="package-tile-name">
                    <strong>{packageName(item.name).title}</strong>
                    <small>{packageName(item.name).owner}</small>
                  </span>
                  <span className="package-tile-description">
                    {item.description}
                  </span>
                  <PackageMetadata
                    item={item}
                    installed={installedNames.includes(item.name)}
                  />
                </button>
              ))}
            </div>
          </section>
        )
      })}
      {search.data?.items.length === 0 && (
        <p className="home-empty">No packages match this search.</p>
      )}
      {search.data && search.data.items.length >= 100 && (
        <p className="home-muted">
          Showing the first 100 results. Search to narrow the list.
        </p>
      )}
    </div>
  )
}

function categoryLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
function PackageMetadata({
  item,
  installed,
}: {
  item: KodyCommunityListing
  installed: boolean
}) {
  const published = item.publishedAt ? new Date(item.publishedAt) : null
  return (
    <span className="package-metadata">
      {installed && <span className="package-installed">Installed</span>}
      {!!item.tags.length && (
        <span className="package-tags">
          {item.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </span>
      )}
      <span className="package-stats">
        {item.rating !== null ? (
          <span
            aria-label={`${item.rating.toFixed(1)} out of 5, ${item.ratingCount ?? 0} ratings`}
          >
            <Star size={13} />
            {item.rating.toFixed(1)}
            {item.ratingCount !== undefined && ` (${item.ratingCount})`}
          </span>
        ) : (
          <span>No ratings yet</span>
        )}
        <span>
          <GitFork size={13} />
          {item.forkCount} {item.forkCount === 1 ? 'fork' : 'forks'}
        </span>
        {item.version && <span>v{item.version}</span>}
      </span>
      <span className="package-stats">
        {published && !Number.isNaN(published.getTime()) && (
          <time dateTime={item.publishedAt}>
            Published{' '}
            {published.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </time>
        )}
        {item.effort != null && (
          <span title="Average adaptation effort: 1 is trivial, 5 is very hard">
            Adaptation effort {item.effort.toFixed(1)}/5
          </span>
        )}
      </span>
    </span>
  )
}
