import * as React from 'react'
import { Link, useMatches } from '@tanstack/react-router'
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa'
import { last } from '~/utils/utils'
import { MenuItem } from '~/utils/config'

type DocPaginationProps = {
  config: MenuItem[]
  colorFrom: string
  colorTo: string
  textColor: string
}

export function DocPagination({
  config,
  colorFrom,
  colorTo,
  textColor,
}: DocPaginationProps) {
  const matches = useMatches()

  const flatMenu = React.useMemo(
    () => config.flatMap((d) => d?.children),
    [config]
  )

  const lastMatch = last(matches)
  const docsMatch = matches.find((d) => d.pathname.includes('/docs'))

  const relativePathname = lastMatch.pathname.replace(
    docsMatch!.pathname + '/',
    ''
  )

  const index = flatMenu.findIndex((d) => d?.to === relativePathname)
  const prevItem = flatMenu[index - 1]
  const nextItem = flatMenu[index + 1]

  return (
    <div className="fixed flex items-center flex-wrap bottom-2 left-0 lg:left-[250px] z-10 right-0 text-xs md:text-sm px-1">
      <div className="w-1/2 px-1 flex justify-end flex-wrap">
        {prevItem ? (
          <Link
            to={prevItem.to}
            params
            className="py-1 px-2 bg-white/70 text-black dark:bg-gray-500/40 dark:text-white shadow-lg shadow-black/20 flex items-center justify-center backdrop-blur-sm z-20 rounded-lg overflow-hidden"
          >
            <div className="flex gap-2 items-center font-bold">
              <FaArrowLeft />
              {prevItem.label}
            </div>
          </Link>
        ) : null}
      </div>
      <div className="w-1/2 px-1 flex justify-start flex-wrap">
        {nextItem ? (
          <Link
            to={nextItem.to}
            params
            className="py-1 px-2 bg-white/70 text-black dark:bg-gray-500/40 dark:text-white shadow-lg shadow-black/20 flex items-center justify-center backdrop-blur-sm z-20 rounded-lg overflow-hidden"
          >
            <div className="flex gap-2 items-center font-bold">
              <span
                className={`bg-gradient-to-r ${colorFrom} ${colorTo} bg-clip-text text-transparent`}
              >
                {nextItem.label}
              </span>{' '}
              <FaArrowRight className={textColor} />
            </div>
          </Link>
        ) : null}
      </div>
    </div>
  )
}
