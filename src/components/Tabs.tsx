import * as React from 'react'

export type TabDefinition = {
  slug: string
  name: string
  headers?: Array<string>
}

export type TabsProps = {
  tabs: Array<TabDefinition>
  children: Array<React.ReactNode>
}

export function Tabs({ tabs, children }: TabsProps) {
  const [activeSlug, setActiveSlug] = React.useState(
    () => tabs[0]?.slug ?? 'tab'
  )

  return (
    <div className="not-prose">
      <div className="flex gap-2 border-b border-gray-500/20">
        {tabs.map((tab) => (
          <button
            key={tab.slug}
            aria-label={tab.name}
            title={tab.name}
            type="button"
            onClick={() => setActiveSlug(tab.slug)}
            className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 -mb-[1px] border-b-2 text-sm font-bold transition-colors ${
              activeSlug === tab.slug
                ? 'border-current text-current'
                : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <span>{tab.name}</span>
          </button>
        ))}
      </div>
      <div className="border border-gray-500/20 rounded-b-md rounded-tr-md p-4">
        {children.map((child, index) => {
          const tab = tabs[index]
          if (!tab) return null
          return (
            <div
              key={tab.slug}
              data-tab={tab.slug}
              hidden={tab.slug !== activeSlug}
              className="prose dark:prose-invert max-w-none"
            >
              {child}
            </div>
          )
        })}
      </div>
    </div>
  )
}
