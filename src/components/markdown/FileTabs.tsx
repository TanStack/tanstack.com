import * as React from 'react'

export type FileTabDefinition = {
  slug: string
  name: string
}

export type FileTabsProps = {
  tabs: Array<FileTabDefinition>
  children: Array<React.ReactNode> | React.ReactNode
}

export function FileTabs({ tabs, children }: FileTabsProps) {
  const id = React.useId()
  const childrenArray = React.Children.toArray(children)
  const [activeSlug, setActiveSlug] = React.useState(tabs[0]?.slug ?? '')

  if (tabs.length === 0) return null

  return (
    <div className="not-prose my-4">
      <div
        role="tablist"
        className="fade-x fade-size-x-sm flex items-center justify-start gap-1 overflow-x-auto overflow-y-hidden border-b border-border-default"
      >
        {tabs.map((tab) => {
          const isActive = activeSlug === tab.slug
          return (
            <button
              key={`${id}-${tab.slug}`}
              type="button"
              role="tab"
              id={`${id}-tab-${tab.slug}`}
              aria-selected={isActive}
              aria-controls={`${id}-panel-${tab.slug}`}
              onClick={() => setActiveSlug(tab.slug)}
              aria-label={tab.name}
              title={tab.name}
              className={`relative -mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? 'border-text-primary text-text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.name}
            </button>
          )
        })}
      </div>
      <div>
        {childrenArray.map((child, index) => {
          const tab = tabs[index]
          if (!tab) return null
          const isActive = tab.slug === activeSlug
          return (
            <div
              key={`${id}-${tab.slug}-panel`}
              role="tabpanel"
              id={`${id}-panel-${tab.slug}`}
              aria-labelledby={`${id}-tab-${tab.slug}`}
              data-tab={tab.slug}
              data-content="code-only"
              className={`overflow-hidden rounded-b-md border border-t-0 border-border-default ${
                isActive ? '' : 'hidden'
              }`}
            >
              {child}
            </div>
          )
        })}
      </div>
    </div>
  )
}
