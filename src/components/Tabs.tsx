import { getRouteApi } from '@tanstack/react-router'
import * as React from 'react'
import { getFrameworkOptions } from '~/libraries/frameworks'

export type TabDefinition = {
  slug: string
  name: string
  headers?: Array<string>
}

export type TabsProps = {
  tabs: Array<TabDefinition>
  children: Array<React.ReactNode>
  id: string
}

export function Tabs({ tabs, id, children }: TabsProps) {
  const Route = getRouteApi()
  const { framework } = Route.useParams()

  const [activeSlug, setActiveSlug] = React.useState(
    () => tabs.find((tab) => tab.slug === framework)?.slug || tabs[0].slug,
  )

  return (
    <div className="not-prose my-4">
      <div className="flex items-center justify-start gap-2 rounded-t-md border-1 border-b-none border-gray-200 dark:border-gray-800 overflow-x-auto scrollbar-hide bg-white dark:bg-gray-950">
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
      <div className="border border-gray-500/20 rounded-b-md p-4 bg-white dark:bg-gray-900">
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
  key,
  tab,
  activeSlug,
  setActiveSlug,
}: {
  id: string
  tab: TabDefinition
  activeSlug: string
  setActiveSlug: React.Dispatch<React.SetStateAction<string>>
}) => {
  const options = React.useMemo(() => getFrameworkOptions(tab.slug), [tab.slug])
  return (
    <button
      key={key}
      aria-label={tab.name}
      title={tab.name}
      type="button"
      onClick={() => setActiveSlug(tab.slug)}
      className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 -mb-[1px] border-b-2 text-sm font-bold transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 rounded-t-md ${
        activeSlug === tab.slug
          ? 'border-current text-current bg-gray-900'
          : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
      }`}
    >
      {options[0] ? (
        <img src={options[0].logo} alt="" className="w-4 h-4 -ml-1" />
      ) : null}
      <span>{tab.name}</span>
    </button>
  )
}
