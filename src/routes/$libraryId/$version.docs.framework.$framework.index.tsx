import { redirect } from '@tanstack/react-router'
import { Doc } from '~/components/Doc'
import { DocContainer } from '~/components/DocContainer'
import { DocTitle } from '~/components/DocTitle'
import {
  Framework,
  getBranch,
  getFrameworkOptions,
  getLibrary,
} from '~/libraries'
import { loadDocs } from '~/utils/docs'
import { seo } from '~/utils/seo'
import { capitalize } from '~/utils/utils'
import { twMerge } from 'tailwind-merge'

export const Route = createFileRoute({
  staleTime: 1000 * 60 * 5,
  loader: (ctx) => {
    const { framework, version, libraryId } = ctx.params

    const [frameworkOption] = getFrameworkOptions([framework as Framework])

    return {
      title: frameworkOption.label,
    }
  },
  head: (ctx) => {
    const library = getLibrary(ctx.params.libraryId)
    const tail = `${library.name} ${capitalize(ctx.params.framework)} Docs`

    return {
      meta: seo({
        title: ctx.loaderData?.title
          ? `${ctx.loaderData.title} | ${tail}`
          : tail,
        description: ctx.loaderData?.description,
      }),
    }
  },
  component: Comp,
})

function Comp() {
  const { framework, version, libraryId } = Route.useParams()
  const library = getLibrary(libraryId)
  const [frameworkOption] = getFrameworkOptions([framework as Framework])

  return (
    <DocContainer>
      <div
        className={twMerge('mx-auto flex w-full bg-white/70 dark:bg-black/40')}
      >
        <div
          className={twMerge(
            'ml-auto flex w-full max-w-[820px] flex-col overflow-auto p-4.5',
          )}
        >
          <DocTitle>
            TanStack {frameworkOption.label}{' '}
            {library.name.replace('TanStack ', '')} Documentation
          </DocTitle>
          <div className="h-4" />
          <div className="h-px bg-gray-500 opacity-20" />
          <div className="h-4" />
          <div
            className={twMerge(
              'prose prose-gray prose-sm prose-p:leading-7 dark:prose-invert max-w-none',
              'styled-markdown-content',
            )}
          >
            Use the menu to select a documentation page.
          </div>
          <div className="h-24" />
        </div>
      </div>
    </DocContainer>
  )
}
