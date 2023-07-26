import { DocSearch } from '@docsearch/react'
import * as React from 'react'
import { CgClose, CgMenuLeft } from 'react-icons/cg'
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa'
import { NavLink, Outlet, useMatches } from '@remix-run/react'
import { last } from '~/utils/utils'
import { Carbon } from './Carbon'
import { LinkOrA } from './LinkOrA'
import { Search } from './Search'
import { gradientText } from '~/routes/query/$version/index'
import BytesForm from './BytesForm'
import type { SelectProps } from './Select'
import { Select } from './Select'

export type DocsConfig = {
  docSearch: {
    appId: string
    indexName: string
    apiKey: string
  }
  menu: {
    label: string | React.ReactNode
    children: {
      label: string | React.ReactNode
      to: string
      badge?: string
    }[]
  }[]
}

export function Docs({
  colorFrom,
  colorTo,
  textColor,
  logo,
  config,
  framework,
  version,
  children,
  v2,
}: {
  colorFrom: string
  colorTo: string
  textColor: string
  logo: React.ReactNode
  config: DocsConfig
  framework?: SelectProps
  version?: SelectProps
  children?: any
  v2?: boolean
}) {
  const matches = useMatches()
  console.log(matches)
  const lastMatch = last(matches)

  const detailsRef = React.useRef<HTMLElement>(null!)

  const flatMenu = React.useMemo(
    () => config.menu.flatMap((d) => d.children),
    [config.menu]
  )

  const docsMatch = matches.find((d) => d.pathname.includes('/docs'))

  const relativePathname = lastMatch.pathname.replace(
    docsMatch?.pathname! + '/',
    ''
  )

  const index = flatMenu.findIndex((d) => d.to === relativePathname)
  const prevItem = flatMenu[index - 1]
  const nextItem = flatMenu[index + 1]

  const menuItems = config.menu.map((group, i) => {
    return (
      <div key={i}>
        <div className="text-[.9em] uppercase font-black">{group.label}</div>
        <div className="h-2" />
        <div className="ml-2 space-y-px text-[.9em]">
          {group.children?.map((child, i) => {
            const linkClasses = `flex items-center justify-between group px-2 py-1 rounded-lg hover:bg-gray-500 hover:bg-opacity-10`

            return (
              <div key={i}>
                {child.to.startsWith('http') ? (
                  <a href={child.to} className={linkClasses}>
                    {child.label}
                  </a>
                ) : (
                  <NavLink
                    to={v2 ? child.to : framework ? '../' + child.to : child.to}
                    onClick={() => {
                      detailsRef.current.removeAttribute('open')
                    }}
                    end
                  >
                    {(props) => {
                      return (
                        <div className={linkClasses}>
                          <span
                            className={
                              props.isActive
                                ? `font-bold text-transparent bg-clip-text bg-gradient-to-r ${colorFrom} ${colorTo}`
                                : ''
                            }
                          >
                            {child.label}
                          </span>
                          {child.badge ? (
                            <span
                              className={`text-xs ${
                                props.isActive ? 'opacity-100' : 'opacity-40'
                              } group-hover:opacity-100 font-bold transition-opacity ${
                                child.badge === 'react'
                                  ? 'text-sky-500'
                                  : child.badge === 'solid'
                                  ? 'bg-blue-500'
                                  : child.badge === 'svelte'
                                  ? 'bg-orange-500'
                                  : child.badge === 'vue'
                                  ? 'bg-green-500'
                                  : 'text-gray-500'
                              }`}
                            >
                              {child.badge}
                            </span>
                          ) : null}
                        </div>
                      )
                    }}
                  </NavLink>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  })

  const smallMenu = (
    <div
      className="lg:hidden bg-white sticky top-0 z-20
              dark:bg-black"
    >
      <details
        ref={detailsRef as any}
        id="docs-details"
        className="border-b border-gray-500 border-opacity-20"
      >
        <summary className="p-4 flex gap-2 items-center justify-between">
          <div className="flex gap-2 items-center text-xl md:text-2xl">
            <CgMenuLeft className="icon-open mr-2 cursor-pointer" />
            <CgClose className="icon-close mr-2 cursor-pointer" />
            {logo}
          </div>
          <Search {...config.docSearch} />
        </summary>
        <div
          className="flex flex-col gap-4 p-4 whitespace-nowrap h-[0vh] overflow-y-auto
          border-t border-gray-500 border-opacity-20 bg-gray-100 text-lg
          dark:bg-gray-900"
        >
          <div className="flex gap-4">
            {framework?.selected ? (
              <Select
                label={framework.label}
                selected={framework.selected}
                available={framework.available}
                onSelect={framework.onSelect}
              />
            ) : null}
            {version?.selected ? (
              <Select
                label={version.label}
                selected={version.selected}
                available={version.available}
                onSelect={version.onSelect}
              />
            ) : null}
          </div>
          {menuItems}
        </div>
      </details>
    </div>
  )

  const largeMenu = (
    <div className="min-w-[250px] hidden lg:flex flex-col gap-4 h-screen sticky top-0 z-20">
      <div className="px-4 pt-4 flex gap-2 items-center text-2xl">{logo}</div>
      <div>
        <DocSearch
          appId={config.docSearch.appId}
          indexName={config.docSearch.indexName}
          apiKey={config.docSearch.apiKey}
        />
      </div>
      <div className="flex gap-2 px-4">
        {framework?.selected ? (
          <Select
            className="flex-[3_1_0%]"
            label={framework.label}
            selected={framework.selected}
            available={framework.available}
            onSelect={framework.onSelect}
          />
        ) : null}
        {version?.selected ? (
          <Select
            className="flex-[2_1_0%]"
            label={version.label}
            selected={version.selected}
            available={version.available}
            onSelect={version.onSelect}
          />
        ) : null}
      </div>
      <div className="flex-1 flex flex-col gap-4 px-4 whitespace-nowrap overflow-y-auto text-base pb-[300px]">
        {menuItems}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col lg:flex-row w-full">
      {smallMenu}
      {largeMenu}
      <div className="flex-1 min-w-0 min-h-0 flex relative justify-center">
        {children || <Outlet />}
        <div
          className="fixed bottom-0 left-0 right-0
                      lg:pl-[250px] z-10"
        >
          <div className="p-4 flex justify-center gap-4">
            {prevItem ? (
              <LinkOrA
                to={
                  v2
                    ? prevItem.to
                    : framework
                    ? `../${prevItem.to}`
                    : prevItem.to
                }
                className="flex gap-2 items-center py-1 px-2 text-sm self-start rounded-md
              bg-white text-gray-600 dark:bg-black dark:text-gray-400
              shadow-lg dark:border dark:border-gray-800
              lg:text-lg"
              >
                <FaArrowLeft /> {prevItem.label}
              </LinkOrA>
            ) : null}
            {nextItem ? (
              <LinkOrA
                to={
                  v2
                    ? nextItem.to
                    : framework
                    ? `../${nextItem.to}`
                    : nextItem.to
                }
                className="py-1 px-2 text-sm self-end rounded-md
                bg-white dark:bg-black
                shadow-lg dark:border dark:border-gray-800
                lg:text-lg
                "
              >
                <div className="flex gap-2 items-center font-bold">
                  <span
                    className={`bg-gradient-to-r ${colorFrom} ${colorTo} bg-clip-text text-transparent`}
                  >
                    {nextItem.label}
                  </span>{' '}
                  <FaArrowRight className={textColor} />
                </div>
              </LinkOrA>
            ) : null}
          </div>
        </div>
      </div>
      <aside className="w-[25vw] hidden md:block max-w-[350px]">
        <div className="p-6 sticky top-0">
          <ul className="border border-black/10 dark:border-white/10 p-6 rounded-lg">
            {config?.docSearch?.indexName?.includes('query') && (
              <li className="mb-8">
                <h6 className="text-[.9em] uppercase font-black mb-4">
                  Want to Skip the Docs?
                </h6>
                <p className="text-sm">
                  Fast track your learning and <br />
                  <a
                    className={`${gradientText}`}
                    href="https://ui.dev/react-query?from=tanstack"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>take the offical React Query course ↗️</span>
                  </a>
                </p>
              </li>
            )}
            <li>
              <h6 className="text-[.9em] uppercase font-black mb-4">
                Subscribe to Bytes
              </h6>
              <p className="text-sm mb-4">
                Your weekly dose of JavaScript news. Delivered every Monday to
                over 100,000 devs, for free.
              </p>
              <BytesForm />
            </li>
          </ul>
        </div>
        <div className="carbon-small p-6 fixed bottom-0">
          <Carbon />
        </div>
      </aside>
    </div>
  )
}
