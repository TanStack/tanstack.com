import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import { DocContainer } from '~/components/DocContainer'
import { DocTitle } from '~/components/DocTitle'
import { getFrameworkOptions, getLibrary } from '~/libraries'

export const Route = createFileRoute({
  component: RouteComponent,
})

function RouteComponent() {
  const { libraryId } = Route.useParams()
  const library = getLibrary(libraryId)

  const frameworks = getFrameworkOptions(library.frameworks)

  return (
    <DocContainer>
      <div
        className={twMerge(
          'w-full flex bg-white/70 dark:bg-black/40 mx-auto rounded-xl max-w-[936px]'
        )}
      >
        <div
          className={twMerge('flex overflow-auto flex-col w-full p-4 lg:p-6')}
        >
          <DocTitle>Supported {library.name} Frameworks</DocTitle>
          <div className="h-4" />
          <div className="h-px bg-gray-500 opacity-20" />
          <div className="h-4" />
          <div
            className={twMerge(
              'prose prose-gray prose-sm prose-p:leading-7 dark:prose-invert max-w-none',
              'styled-markdown-content'
            )}
          >
            <ul className="text-lg">
              {frameworks.map((framework) => (
                <li key={framework.value}>
                  <Link
                    to={`./${framework.value}`}
                    className="flex items-center gap-2"
                  >
                    <img
                      src={framework.logo}
                      alt={framework.label}
                      className="w-4 h-4 p-0 m-0"
                    />
                    TanStack {framework.label}{' '}
                    {library.name.replace('TanStack ', '')}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="h-24" />
        </div>
      </div>
    </DocContainer>
  )
}
