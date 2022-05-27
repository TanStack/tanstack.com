import * as React from 'react'
import { FaArrowLeft, FaArrowRight, FaDiscord, FaGithub } from 'react-icons/fa'
import { CgClose, CgMenuLeft } from 'react-icons/cg'
import {
  Link,
  MetaFunction,
  NavLink,
  Outlet,
  useLoaderData,
  useLocation,
  useMatches,
} from 'remix'
import { last, useMatchesData } from '~/utils/utils'
import { useReactTableV8Config, V8Config } from '../v8'
import { DocSearch } from '@docsearch/react'
import { gradientText } from './index'
import { Search } from '../../../components/Search'
import { Carbon } from '~/components/Carbon'
import { seo } from '~/utils/seo'
import { LinkOrA } from '~/components/LinkOrA'

const logo = (
  <>
    <Link to="/" className="font-light">
      TanStack
    </Link>
    <Link to=".." className={`font-bold`}>
      <span className={`${gradientText}`}>Table</span>{' '}
      <span className="text-sm align-super">v8</span>
    </Link>
  </>
)

const localMenu = {
  label: 'Menu',
  children: [
    {
      label: 'Home',
      to: '..',
    },
    {
      label: (
        <div className="flex items-center gap-2">
          Github <FaGithub className="text-lg opacity-20" />
        </div>
      ),
      to: 'https://github.com/tanstack/table',
    },
    {
      label: (
        <div className="flex items-center gap-2">
          Discord <FaDiscord className="text-lg opacity-20" />
        </div>
      ),
      to: 'https://tlinz.com/discord',
    },
  ],
}

export let meta: MetaFunction = () => {
  return seo({
    title:
      'TanStack Table Docs | React Table, Solid Table, Svelte Table, Vue Table',
    description:
      'Headless UI for building powerful tables & datagrids with TS/JS, React, Solid, Svelte and Vue',
  })
}

export default function RouteReactTable() {
  const config = useReactTableV8Config()
  const matches = useMatches()
  const lastMatch = last(matches)

  const detailsRef = React.useRef<HTMLElement>(null!)

  const flatMenu = React.useMemo(
    () => [localMenu, ...config.menu].flatMap((d) => d.children),
    [config.menu]
  )

  const relativePathname = lastMatch.pathname.replace('/table/v8/docs/', '')

  const index = flatMenu.findIndex((d) => d.to === relativePathname)
  const prevItem = flatMenu[index - 1]
  const nextItem = flatMenu[index + 1]

  const menuItems = [localMenu, ...config.menu].map((group) => {
    return (
      <div key={group.label}>
        <div className="text-[.9em] uppercase font-black">{group.label}</div>
        <div className="h-2" />
        <div className="pl-2 space-y-2 text-[.9em]">
          {group.children?.map((child, i) => {
            return (
              <div key={i}>
                {child.to.startsWith('http') ? (
                  <a href={child.to}>{child.label}</a>
                ) : (
                  <NavLink
                    to={child.to}
                    className={(props) =>
                      props.isActive
                        ? `font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-violet-600`
                        : ''
                    }
                    onClick={() => {
                      detailsRef.current.removeAttribute('open')
                    }}
                    end
                  >
                    {child.label}
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
        ref={detailsRef}
        id="docs-details"
        className="border-b border-gray-500 border-opacity-20"
      >
        <summary className="p-4 flex gap-2 items-center justify-between">
          <div className="flex gap-2 items-center text-xl md:text-2xl">
            <CgMenuLeft className="icon-open mr-2 cursor-pointer" />
            <CgClose className="icon-close mr-2 cursor-pointer" />
            {logo}
          </div>
          <Search />
        </summary>
        <div
          className="flex flex-col gap-4 p-4 whitespace-nowrap h-[0vh] overflow-y-auto
          border-t border-gray-500 border-opacity-20 bg-gray-100 text-lg
          dark:bg-gray-900"
        >
          {menuItems}
        </div>
      </details>
    </div>
  )

  const largeMenu = (
    <div className="hidden lg:flex w-[250px] flex-col gap-4 h-screen sticky top-0 z-20">
      <div className="px-4 pt-4 flex gap-2 items-center text-2xl">{logo}</div>
      <div>
        <DocSearch
          appId={config.docSearch.appId}
          indexName={config.docSearch.indexName}
          apiKey={config.docSearch.apiKey}
        />
      </div>
      <div className="flex-1 flex flex-col gap-4 px-4 whitespace-nowrap overflow-y-auto text-base pb-[300px]">
        {menuItems}
      </div>
      <div className="carbon-small absolute bottom-0 w-full">
        <Carbon />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {smallMenu}
      {largeMenu}
      <div className="flex-1 min-h-0 flex relative">
        <Outlet />
        <div
          className="fixed bottom-0 left-0 right-0
                      lg:pl-[250px]"
        >
          <div className="p-4 flex justify-center gap-4">
            {prevItem ? (
              <LinkOrA
                to={prevItem.to}
                className="flex gap-2 items-center py-1 px-2 text-sm self-start rounded-md
              bg-white text-gray-600 dark:bg-gray-900 dark:text-gray-400
              shadow-lg dark:border dark:border-gray-800
              lg:text-lg"
              >
                <FaArrowLeft /> {prevItem.label}
              </LinkOrA>
            ) : null}
            {nextItem ? (
              <LinkOrA
                to={nextItem.to}
                className="py-1 px-2 text-sm self-end rounded-md
                bg-white dark:bg-gray-900
                shadow-lg dark:border dark:border-gray-800
                lg:text-lg
                "
              >
                <div className="flex gap-2 items-center font-bold">
                  <span className="bg-gradient-to-r from-rose-500 to-violet-500 bg-clip-text text-transparent">
                    {nextItem.label}
                  </span>{' '}
                  <FaArrowRight className="text-violet-500" />
                </div>
              </LinkOrA>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
  //  : (
  //   <div className="flex items-start min-h-0 h-screen">
  //     <div
  //       className="p-8 flex w-[300px] min-h-0 h-screen overflow-y-auto
  //       flex-col gap-4 whitespace-nowrap"
  //     >
  //       <div className="flex flex-col text-2xl">{logo}</div>
  //       {menu}
  //     </div>
  //     <div className="flex-1 h-screen pl-4 overflow-y-auto flex flex-col">
  //       <div className="h-12" />
  //       <div className="flex-1 min-h-0">
  //         <Outlet />
  //       </div>
  //     </div>
  //   </div>
  // )
}
