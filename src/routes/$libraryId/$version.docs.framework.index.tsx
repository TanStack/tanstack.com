import { Link } from '@tanstack/react-router'
import { DocContainer } from '~/components/DocContainer'
import { DocTitle } from '~/components/DocTitle'
import { getFrameworkOptions, getLibrary } from '~/libraries'
import { twMerge } from 'tailwind-merge'

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
        className={twMerge('mx-auto flex w-full bg-white/70 dark:bg-black/40')}
      >
        <div className={twMerge('flex w-full flex-col overflow-auto p-4.5')}>
          <DocTitle>Supported {library.name} Frameworks</DocTitle>
          <div className="h-4" />
          <div className="h-px bg-gray-500 opacity-20" />
          <div className="h-4" />
          <div
            className={twMerge(
              'prose prose-gray prose-sm prose-p:leading-7 dark:prose-invert max-w-none',
              'styled-markdown-content',
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
                      className="m-0 h-4 w-4 p-0"
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
