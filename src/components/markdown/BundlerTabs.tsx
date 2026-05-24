import * as React from 'react'
import { create } from 'zustand'
import { Tabs, type TabDefinition } from './Tabs'
import {
  BUNDLERS,
  BUNDLER_LABELS,
  DEFAULT_BUNDLER,
  isBundler,
  type Bundler,
} from '~/utils/markdown/bundler'

const useBundlerStore = create<{
  bundler: Bundler
  setBundler: (bundler: Bundler) => void
}>((set) => ({
  bundler: DEFAULT_BUNDLER,
  setBundler: (bundler) => {
    if (typeof document !== 'undefined') {
      localStorage.setItem('bundler', bundler)
    }
    set({ bundler })
  },
}))

let hasHydratedBundlerStore = false

function useHydrateBundlerStore() {
  React.useEffect(() => {
    if (hasHydratedBundlerStore) return
    hasHydratedBundlerStore = true
    const stored = localStorage.getItem('bundler')
    if (stored && isBundler(stored)) {
      useBundlerStore.setState({ bundler: stored })
    }
  }, [])
}

const tabDefinitions: TabDefinition[] = BUNDLERS.map((b) => ({
  slug: b,
  name: BUNDLER_LABELS[b],
  headers: [],
}))

export type BundlerTabsProps = {
  tabs: Array<{ slug: string; name: string }>
  panelContent?: Record<string, 'code-only' | 'mixed'>
  children: Array<React.ReactNode> | React.ReactNode
}

export function BundlerTabs({
  tabs,
  panelContent,
  children,
}: BundlerTabsProps) {
  useHydrateBundlerStore()

  const activeBundler = useBundlerStore((s) => s.bundler)
  const setBundler = useBundlerStore((s) => s.setBundler)

  const { renderedChildren, contentBySlug } = React.useMemo(() => {
    const childrenArray = React.Children.toArray(children)
    const panelsBySlug = new Map<string, React.ReactNode>()
    const slugContent: Record<string, 'code-only' | 'mixed'> = {}
    tabs.forEach((tab, index) => {
      panelsBySlug.set(tab.slug, childrenArray[index])
    })
    const fallbackPanel = childrenArray[0]
    const fallbackContent = tabs[0]
      ? (panelContent?.[tabs[0].slug] ?? 'mixed')
      : 'mixed'
    const ordered = BUNDLERS.map((b) => {
      slugContent[b] = panelContent?.[b] ?? fallbackContent
      return panelsBySlug.get(b) ?? fallbackPanel
    })
    return { renderedChildren: ordered, contentBySlug: slugContent }
  }, [children, tabs, panelContent])

  const handleTabChange = React.useCallback(
    (slug: string) => {
      if (isBundler(slug)) {
        setBundler(slug)
      }
    },
    [setBundler],
  )

  return (
    <Tabs
      tabs={tabDefinitions}
      /* eslint-disable-next-line react/no-children-prop */
      children={renderedChildren}
      activeSlug={activeBundler}
      onTabChange={handleTabChange}
      panelContent={contentBySlug}
    />
  )
}
