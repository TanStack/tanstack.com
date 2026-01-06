import { useParams } from '@tanstack/react-router'
import * as React from 'react'
import { frameworkOptions } from '~/libraries/frameworks'

export type TabDefinition = {
  slug: string
  name: string
  headers?: Array<string>
}

export type TabsProps = {
  tabs: Array<TabDefinition>
  children: Array<React.ReactNode>
  id: string
  activeSlug?: string
  onTabChange?: (slug: string) => void
}

export function Tabs({ tabs, id, children, activeSlug: controlledActiveSlug, onTabChange }: TabsProps) {
  const params = useParams({ strict: false })
  const framework = 'framework' in params ? params.framework : undefined

  const [internalActiveSlug, setInternalActiveSlug] = React.useState(
    () => tabs.find((tab) => tab.slug === framework)?.slug || tabs[0].slug,
  )

  // Use controlled state if provided, otherwise use internal state
  const activeSlug = controlledActiveSlug ?? internalActiveSlug
  const setActiveSlug = React.useCallback((slug: string) => {
    if (onTabChange) {
      onTabChange(slug)
    } else {
      setInternalActiveSlug(slug)
    }
  }, [onTabChange])

  return (
    <div className="not-prose my-4">
      <div className="flex items-center justify-start gap-2 rounded-t-md border-1 border-b-none border-gray-200 dark:border-gray-800 overflow-x-auto overflow-y-hidden bg-white dark:bg-gray-950">
        {tabs.map((tab) => {
          return (
            <Tab
              key={`${id}-${tab.slug}`}
              id={id}
              tab={tab}
              activeSlug={activeSlug}
              setActiveSlug={setActiveSlug}
            />
          )
        })}
      </div>
      <div className="border border-gray-500/20 rounded-b-md p-4 bg-gray-100 dark:bg-gray-900">
        {children.map((child, index) => {
          const tab = tabs[index]
          if (!tab) return null
          return (
            <div
              key={`${id}-${tab.slug}`}
              data-tab={tab.slug}
              hidden={tab.slug !== activeSlug}
              className="prose dark:prose-invert max-w-none flex flex-col gap-2 text-base"
            >
              {child}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const Tab = ({
  tab,
  activeSlug,
  setActiveSlug,
}: {
  id: string
  tab: TabDefinition
  activeSlug: string
  setActiveSlug: (slug: string) => void
}) => {
  const option = React.useMemo(
    () => frameworkOptions.find((o) => o.value === tab.slug),
    [tab.slug],
  )
  return (
    <button
      aria-label={tab.name}
      title={tab.name}
      type="button"
      onClick={() => setActiveSlug(tab.slug)}
      className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 -mb-[1px] border-b-2 text-sm font-bold transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 rounded-t-md overflow-y-none ${
        activeSlug === tab.slug
          ? 'border-current text-current bg-gray-100 dark:bg-gray-900'
          : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
      }`}
    >
      {option ? (
        <img src={option.logo} alt="" className="w-4 h-4 -ml-1" />
      ) : null}
      <span>{tab.name}</span>
    </button>
  )
}
