import * as React from 'react'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { ChartsCatalogChart } from '~/components/charts/ChartsCatalogChart'
import {
  isChartsCatalogEmbedTheme,
  parseChartsCatalogEmbedRouteSearch,
  validateChartsCatalogEmbedRouteSearch,
  type ChartsCatalogEmbedTheme,
} from '~/utils/charts-catalog-embed'
import { getChartsCatalogEmbedCase } from '~/utils/charts-catalog.functions'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/charts/catalog_/embed/$caseId')({
  validateSearch: validateChartsCatalogEmbedRouteSearch,
  loaderDeps: ({ search }) => parseChartsCatalogEmbedRouteSearch(search),
  loader: async ({ deps, params }) => {
    const data = await getChartsCatalogEmbedCase({
      data: { caseId: params.caseId },
    })
    if (!data) throw notFound()

    return {
      ...data,
      ...deps,
    }
  },
  component: ChartsCatalogEmbedRoute,
  head: ({ loaderData }) => ({
    meta: seo({
      title: loaderData
        ? `${loaderData.case.title} | TanStack Charts`
        : 'TanStack Charts',
      description: 'Embeddable TanStack Charts example.',
      noindex: true,
    }),
  }),
  staticData: {
    baseParent: true,
    showNavbar: false,
  },
})

function ChartsCatalogEmbedRoute() {
  const data = Route.useLoaderData()
  const [theme, setTheme] = React.useState<ChartsCatalogEmbedTheme>(data.theme)
  const [parentOrigin, setParentOrigin] = React.useState<string | null>(null)

  React.useEffect(() => {
    setParentOrigin(resolveParentOrigin())
  }, [])

  React.useEffect(() => {
    applyEmbedTheme(theme)
    if (theme !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => applyEmbedTheme('system')
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [theme])

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (
        event.source !== window.parent ||
        event.origin !== parentOrigin ||
        !isThemeCommand(event.data, data.case.id)
      ) {
        return
      }
      setTheme(event.data.theme)
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [data.case.id, parentOrigin])

  const postStatus = React.useCallback(
    (status: 'ready' | 'resize' | 'error') => {
      if (window.parent === window || !parentOrigin) return
      window.parent.postMessage(
        {
          type: 'tanstack-charts:embed',
          version: 1,
          status,
          caseId: data.case.id,
          height: data.height,
        },
        parentOrigin,
      )
    },
    [data.case.id, data.height, parentOrigin],
  )

  return (
    <main className="charts-catalog-embed overflow-hidden p-0">
      <ChartsCatalogChart
        artifactRevision={data.artifactRevision}
        caseId={data.case.id}
        height={data.height}
        module={data.case.module}
        onStatus={postStatus}
        revision={data.revision}
      />
    </main>
  )
}

function resolveParentOrigin() {
  if (typeof document === 'undefined') return null
  if (!document.referrer) return null
  try {
    const url = new URL(document.referrer)
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.origin
      : null
  } catch {
    return null
  }
}

function applyEmbedTheme(theme: ChartsCatalogEmbedTheme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.classList.toggle('light', !dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

function isThemeCommand(
  value: unknown,
  caseId: string,
): value is {
  type: 'tanstack-charts:embed'
  version: 1
  command: 'set-theme'
  caseId: string
  theme: ChartsCatalogEmbedTheme
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'tanstack-charts:embed' &&
    'version' in value &&
    value.version === 1 &&
    'command' in value &&
    value.command === 'set-theme' &&
    'caseId' in value &&
    value.caseId === caseId &&
    'theme' in value &&
    isChartsCatalogEmbedTheme(value.theme)
  )
}
