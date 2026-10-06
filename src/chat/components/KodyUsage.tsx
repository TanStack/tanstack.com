import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { kodyUsageSchema, type KodyUsageResource } from '../core/kody-usage'
import { useWorkspaceApi } from './WorkspaceApi'

const count = new Intl.NumberFormat()

function amount(value: number, resource: string) {
  if (resource.endsWith('_bytes')) {
    if (value >= 1024 ** 3)
      return `${count.format(Math.round((value / 1024 ** 3) * 10) / 10)} GB`
    if (value >= 1024 ** 2)
      return `${count.format(Math.round((value / 1024 ** 2) * 10) / 10)} MB`
    if (value >= 1024)
      return `${count.format(Math.round((value / 1024) * 10) / 10)} KB`
    return `${count.format(value)} bytes`
  }
  return count.format(value)
}

function UsageResource({ item }: { item: KodyUsageResource }) {
  const value = `${amount(item.current, item.resource)} / ${amount(item.limit, item.resource)}`
  const period =
    item.group === 'daily'
      ? ' today (UTC)'
      : item.group === 'monthly'
        ? ' this month (UTC)'
        : ''
  const warning = item.overEightyPercent || item.week?.overEightyPercent
  return (
    <details className="connection-kody-usage-resource">
      <summary>
        <strong>{item.label}</strong>
        <span>
          {warning && 'Near limit · '}
          {value}
          {period}
        </span>
      </summary>
      <div>
        {item.week && (
          <p>
            This week (UTC): {amount(item.week.current, item.resource)} /{' '}
            {amount(item.week.limit, item.resource)}
          </p>
        )}
        {item.whatCounts && <p>{item.whatCounts}</p>}
      </div>
    </details>
  )
}

export function KodyUsage({ accountScope }: { accountScope: string }) {
  const { request, workspaceId } = useWorkspaceApi()
  const [open, setOpen] = useState(false)
  const usage = useQuery({
    queryKey: ['kody-usage', workspaceId, accountScope],
    queryFn: async () => kodyUsageSchema.parse(await request('kody/usage')),
    enabled: open,
    staleTime: 60_000,
    retry: false,
  })
  const primary = usage.data?.resources.filter(
    (item) => item.group === 'daily' || item.group === 'monthly',
  )
  const other = usage.data?.resources.filter(
    (item) => item.group !== 'daily' && item.group !== 'monthly',
  )
  return (
    <details
      className="connection-kody-section"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Kody limits</summary>
      {open && (
        <div className="connection-kody-usage">
          {usage.isFetching && <p role="status">Checking Kody limits…</p>}
          {usage.isError && <p role="alert">{usage.error.message}</p>}
          {usage.data && !usage.isFetching && !usage.isError && (
            <>
              <p>
                {usage.data.plan[0].toUpperCase() + usage.data.plan.slice(1)}
                {' plan · '}Kody resource limits are separate from model usage.
              </p>
              {primary?.map((item) => (
                <UsageResource key={item.resource} item={item} />
              ))}
              {!!other?.length && (
                <details className="connection-kody-usage-other">
                  <summary>Other limits ({other.length})</summary>
                  {other.map((item) => (
                    <UsageResource key={item.resource} item={item} />
                  ))}
                </details>
              )}
            </>
          )}
        </div>
      )}
    </details>
  )
}
