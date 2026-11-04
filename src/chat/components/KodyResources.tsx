import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  kodyResourcePageSchema,
  type KodyResourceKind,
} from '../core/kody-resources'
import { useWorkspaceApi } from './WorkspaceApi'
import { defaultWorkspaceSearch } from '../core/navigation'

export function KodyResources({
  kind,
  accountScope,
}: {
  kind: KodyResourceKind
  accountScope: string
}) {
  const { request, workspaceId } = useWorkspaceApi()
  const [query, setQuery] = useState('')
  const result = useQuery({
    queryKey: ['kody-resources', workspaceId, accountScope, kind],
    queryFn: async () =>
      kodyResourcePageSchema.parse(await request(`kody/resources/${kind}`)),
    refetchInterval: 60000,
    retry: false,
  })
  const items =
    result.data?.items.filter((item) =>
      JSON.stringify([item.name, item.fields])
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) ?? []
  return (
    <section className="home-detail">
      <label className="home-search">
        <input
          type="search"
          aria-label="Filter resources"
          placeholder="Filter…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {result.isPending && <p role="status">Loading…</p>}
      {result.isError && (
        <p role="alert">
          These resources could not be refreshed. Previously loaded records may
          be out of date.
        </p>
      )}
      {result.data?.limited && (
        <p role="status">
          Showing the first 200 records. Filtering searches only these records.
        </p>
      )}
      {result.isSuccess && !items.length && (
        <p>
          {query ? 'No matches in the loaded records.' : 'No records found.'}
        </p>
      )}
      {items.map((item) => (
        <details key={item.id} className="connection-kody-package">
          <summary>{item.name}</summary>
          <dl>
            {item.fields.map((field) => (
              <div key={field.label}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
          {kind === 'shared' && (
            <a
              href="https://kody.codes/account/shared"
              target="_blank"
              rel="noreferrer"
            >
              Manage sharing
            </a>
          )}
          {kind !== 'shared' && item.packageId && workspaceId && (
            <Link
              to="/chat/w/$workspaceId/home/$homeSection"
              params={{ workspaceId, homeSection: 'packages' }}
              search={{ ...defaultWorkspaceSearch, asset: item.packageId }}
            >
              View package
            </Link>
          )}
        </details>
      ))}
      {kind !== 'subscriptions' && (
        <a
          href={`https://kody.codes/account/${kind}`}
          target="_blank"
          rel="noreferrer"
        >
          Manage in Kody
        </a>
      )}
    </section>
  )
}
