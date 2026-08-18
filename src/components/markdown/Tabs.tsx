import { useParams } from '@tanstack/react-router'
import * as React from 'react'
import { frameworkOptions } from '~/libraries/frameworks'

export type TabDefinition = {
  slug: string
  name: string
  headers?: Array<string>
}

export type TabsProps = {
  tabs?: Array<TabDefinition>
  children?: Array<React.ReactNode> | React.ReactNode
  activeSlug?: string
  onTabChange?: (slug: string) => void
  panelContent?: Record<string, string> | string
}

export function Tabs({
  tabs: tabsProp = [],
  children: childrenProp,
  activeSlug: controlledActiveSlug,
  onTabChange,
  panelContent,
}: TabsProps) {
  const isControlled = controlledActiveSlug !== undefined
  const id = React.useId()
  const childrenArray = React.Children.toArray(childrenProp)

  const params = useParams({ strict: false })
  const frameworkParam = isControlled ? undefined : params?.framework

  const [internalActiveSlug, setInternalActiveSlug] = React.useState(() => {
    if (isControlled) return ''
    const match = frameworkParam
      ? tabsProp.find((tab) => tab.slug === frameworkParam)
      : undefined
    return match?.slug ?? tabsProp[0]?.slug ?? ''
  })

  const activeSlug = controlledActiveSlug ?? internalActiveSlug
  const setActiveSlug = React.useCallback(
    (slug: string) => {
      if (onTabChange) {
        onTabChange(slug)
      } else {
        setInternalActiveSlug(slug)
      }
    },
    [onTabChange],
  )

  if (tabsProp.length === 0) return null

  return (
    <div className="my-4">
      <div
        role="tablist"
        className="not-prose fade-x fade-size-x-sm flex items-center justify-start gap-1 overflow-x-auto overflow-y-hidden border-b border-border-default"
      >
        {tabsProp.map((tab) => {
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
      <div className="overflow-hidden rounded-b-md border border-t-0 border-border-default bg-background-subtle">
        {childrenArray.map((child, index) => {
          const tab = tabsProp[index]
          if (!tab) return null
          const isActive = tab.slug === activeSlug
          const content =
            typeof panelContent === 'string'
              ? panelContent
              : panelContent?.[tab.slug]
          return (
            <div
              key={`${id}-${tab.slug}`}
              role="tabpanel"
              id={`${id}-panel-${tab.slug}`}
              aria-labelledby={`${id}-tab-${tab.slug}`}
              data-tab={tab.slug}
              data-content={content}
              className={`max-w-none flex-col gap-2 text-base ${
                isActive ? 'flex' : 'hidden'
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

const Tab = React.memo(function Tab({
  id,
  tab,
  activeSlug,
  setActiveSlug,
}: {
  id?: string
  tab: TabDefinition
  activeSlug: string
  setActiveSlug: (slug: string) => void
}) {
  const option = React.useMemo(
    () =>
      frameworkOptions.find(
        (o) =>
          o.value === tab.slug.toLowerCase() ||
          o.label.toLowerCase() === tab.name.toLowerCase(),
      ),
    [tab.slug, tab.name],
  )

  const isActive = activeSlug === tab.slug

  return (
    <button
      role="tab"
      id={id ? `${id}-tab-${tab.slug}` : undefined}
      aria-selected={isActive}
      aria-controls={id ? `${id}-panel-${tab.slug}` : undefined}
      aria-label={tab.name}
      title={tab.name}
      type="button"
      onClick={() => setActiveSlug(tab.slug)}
      className={`relative -mb-px inline-flex shrink-0 items-center justify-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
        isActive
          ? 'border-text-primary text-text-primary'
          : 'border-transparent text-text-secondary hover:text-text-primary'
      }`}
    >
      {option && <img src={option.logo} alt="" className="w-4 h-4 -ml-1" />}
      <span>{tab.name}</span>
    </button>
  )
})
