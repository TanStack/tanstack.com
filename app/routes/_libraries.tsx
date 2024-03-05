import * as React from 'react'
import { Link, Outlet, createFileRoute, defer } from '@tanstack/react-router'
import { gradients, libraries } from '.'
import { CgClose, CgMenuLeft } from 'react-icons/cg'
import { Carbon } from '~/components/Carbon'
import { twMerge } from 'tailwind-merge'
import { sample, sortBy } from '~/utils/utils'
import { LogoColor } from '~/components/LogoColor'
import logoColor100w from '~/images/logo-color-100w.png'
import { FaInstagram, FaTshirt, FaTwitter } from 'react-icons/fa'
import { getSponsorsForSponsorPack } from '~/server/sponsors'

export const Route = createFileRoute('/_libraries')({
  loader: async (ctx) => {
    return {
      sponsorsPromise: defer(getSponsorsForSponsorPack()),
    }
  },
  component: LibrariesLayout,
})

function LibrariesLayout() {
  const detailsRef = React.useRef<HTMLElement>(null!)

  const items = (
    <>
      {sortBy(libraries, (d) => !d.name.includes('TanStack')).map(
        (library, i) => {
          const linkClasses = twMerge(
            `flex items-center justify-between group px-2 py-1 rounded-lg hover:bg-gray-500 hover:bg-opacity-10 font-black`
          )

          const [prefix, name] = library.name.split(' ')

          return (
            <div key={i}>
              {library.to.startsWith('http') ? (
                <a href={library.to} className={linkClasses}>
                  <span>
                    <span className="font-light dark:font-bold dark:opacity-40">
                      {prefix}
                    </span>{' '}
                    <span className={library.textStyle}>{name}</span>
                  </span>
                </a>
              ) : (
                <Link
                  to={library.to}
                  onClick={() => {
                    detailsRef.current.removeAttribute('open')
                  }}
                  // activeOptions={{
                  //   exact: true,
                  // }}
                >
                  {(props) => {
                    return (
                      <div
                        className={twMerge(
                          linkClasses,
                          props.isActive
                            ? 'bg-gray-500/10 dark:bg-gray-500/30'
                            : ''
                        )}
                      >
                        <span>
                          <span
                            className={twMerge(
                              'font-light dark:font-bold dark:opacity-40',
                              props.isActive ? `font-bold dark:opacity-100` : ''
                            )}
                          >
                            {prefix}
                          </span>{' '}
                          <span className={library.textStyle}>{name}</span>
                        </span>
                        {library.badge ? (
                          <span
                            className={twMerge(
                              `px-2 py-px uppercase font-black bg-gray-500/10 dark:bg-gray-500/20 rounded-full text-[.7rem] group-hover:opacity-100 transition-opacity text-white animate-pulse`,
                              // library.badge === 'new'
                              //   ? 'text-green-500'
                              //   : library.badge === 'soon'
                              //   ? 'text-cyan-500'
                              //   : '',
                              library.textStyle
                            )}
                          >
                            {library.badge}
                          </span>
                        ) : null}
                      </div>
                    )
                  }}
                </Link>
              )}
            </div>
          )
        }
      )}
      <Link
        to="https://cottonbureau.com/people/tanstack"
        className="flex items-center gap-2 p-2"
        key="merch"
      >
        <FaTshirt className="text-2xl" />
        <span className="font-black text-lg">Merch!</span>
        <span
          className={twMerge(
            `ml-auto px-2 py-px uppercase font-black bg-gray-500/10 dark:bg-gray-500/20 rounded-full text-[.7rem] group-hover:opacity-100 transition-opacity animate-pulse text-green-500`
          )}
        >
          New
        </span>
      </Link>
    </>
  )

  const logo = (
    <div className="flex-1 flex items-center gap-4 justify-between">
      <Link to="/" className={twMerge(`flex items-center gap-1.5`)}>
        <img
          src={logoColor100w}
          className="w-[30px] rounded-full overflow-hidden border-2 border-black dark:border-none"
        />
        <div className="font-black">TanStack</div>
      </Link>
      <div className="flex items-center gap-1">
        <a
          href="https://x.com/tan_stack"
          className="opacity-70 hover:opacity-100"
        >
          <FaTwitter className="text-xl" />
        </a>
        <a
          href="https://instagram.com/tan_stack"
          className="opacity-70 hover:opacity-100"
        >
          <FaInstagram className="text-xl" />
        </a>
      </div>
    </div>
  )

  const smallMenu = (
    <div className="lg:hidden bg-white dark:bg-gray-900 sticky top-0 z-20">
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
          {/* <Search {...config.docSearch} /> */}
        </summary>
        <div
          className="flex flex-col gap-4 whitespace-nowrap h-[0vh] overflow-y-auto
          border-t border-gray-500 border-opacity-20 bg-gray-100 text-lg
          dark:bg-gray-900"
        >
          <div className="space-y-px text-sm p-2 border-b border-gray-500/10 dark:border-gray-500/20">
            {items}
          </div>
        </div>
      </details>
    </div>
  )

  const largeMenu = (
    <>
      <div className="min-w-[250px] hidden lg:flex flex-col h-screen sticky top-0 z-20 bg-white dark:bg-gray-900 shadow-xl dark:border-r border-gray-500/20">
        <div className="p-4 flex gap-2 items-center text-2xl border-b border-gray-500/10 dark:border-gray-500/20">
          {logo}
        </div>
        {/* <div>
        <DocSearch
          appId={config.docSearch.appId}
          indexName={config.docSearch.indexName}
          apiKey={config.docSearch.apiKey}
        />
      </div> */}
        {/* <div className="flex gap-2 px-4">
        {frameworkConfig?.selected ? (
          <Select
            className="flex-[3_1_0%]"
            label={frameworkConfig.label}
            selected={frameworkConfig.selected}
            available={frameworkConfig.available}
            onSelect={frameworkConfig.onSelect}
          />
        ) : null}
        {versionConfig?.selected ? (
          <Select
            className="flex-[2_1_0%]"
            label={versionConfig.label}
            selected={versionConfig.selected}
            available={versionConfig.available}
            onSelect={versionConfig.onSelect}
          />
        ) : null}
      </div> */}
        <div className="flex-1 flex flex-col gap-4 whitespace-nowrap overflow-y-auto text-base pb-[300px]">
          <div className="space-y-1 text-sm p-2 border-b border-gray-500/10 dark:border-gray-500/20">
            {items}
          </div>
        </div>
        {/* <div className="carbon-small absolute bottom-0 w-full">
          <Carbon />
        </div> */}
      </div>
    </>
  )

  return (
    <div
      className={`min-h-screen flex flex-col min-w-0 lg:flex-row w-full transition-all duration-300 ${
        '' // isExample ? 'max-w-[2560px]' : 'max-w-[1400px]'
      }`}
    >
      {smallMenu}
      {largeMenu}
      <div className="flex flex-1 min-h-0 relative justify-center overflow-x-hidden">
        {/* <div className="min-w-0 min-h-0 flex relative justify-center flex-1"> */}
        <Outlet />
        {/* </div> */}
        {/* <div className="p-4 max-w-[240px] shrink-0 border-l border-gray-200 dark:border-white/10 hidden md:block">
          {config?.docSearch?.indexName?.includes('query') ? (
            <DocsCalloutQueryGG />
          ) : (
            <DocsCalloutBytes />
          )}
        </div> */}
        {/* {showBytes ? (
          <div className="w-[300px] max-w-[350px] fixed md:hidden top-1/2 right-2 z-30 -translate-y-1/2 shadow-lg">
            <div className="bg-white dark:bg-gray-800 border border-black/10 dark:border-white/10 p-4 md:p-6 rounded-lg">
              {config?.docSearch?.indexName?.includes('query') ? (
                <DocsCalloutQueryGG />
              ) : (
                <DocsCalloutBytes />
              )}
              <button
                className="absolute top-0 right-0 p-2 hover:text-red-500 opacity:30 hover:opacity-100"
                onClick={() => {
                  setShowBytes(false)
                }}
              >
                <FaTimes />
              </button>
            </div>
          </div>
        ) : (
          <button
            className="right-0 top-1/2 -translate-y-[50px] fixed md:hidden"
            onClick={() => {
              setShowBytes(true)
            }}
          >
            <div
              className="origin-bottom-right -rotate-90 text-xs bg-white dark:bg-gray-800 border border-gray-100
            hover:bg-rose-600 hover:text-white p-1 px-2 rounded-t-md shadow-md dark:border-0"
            >
              {config?.docSearch?.indexName?.includes('query') ? (
                <>
                  <strong>
                    <span role="img" aria-label="crystal ball">
                      &#128302;
                    </span>{' '}
                    Skip the docs?
                  </strong>
                </>
              ) : (
                <>
                  Subscribe to <strong>Bytes</strong>
                </>
              )}
            </div>
          </button>
        )} */}
      </div>
    </div>
  )
}
