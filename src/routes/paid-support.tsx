import { Link, createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { useState } from 'react'
import { coreMaintainers } from '~/libraries/maintainers'
import {
  CompactMaintainerCard,
  MaintainerCard,
  MaintainerRowCard,
} from '~/components/MaintainerCard'
import { Grid2x2, Grid3X3, LayoutList, Mail } from 'lucide-react'
import { Button } from '~/ui'

export const Route = createFileRoute('/paid-support')({
  component: PaidSupportComp,
  staleTime: Infinity,
  head: () => ({
    meta: seo({
      title: 'Enterprise Support | TanStack',
      description: `Private consultation and enterprise paid support for projects of any size.`,
      // Keywords to target support for all sizes of companies, including consulting and enterprise paid support
      keywords:
        'tanstack,react,reactjs,react query,react table,open source,open source software,oss,software,consulting,enterprise support,paid support',
    }),
  }),
})

function PaidSupportComp() {
  const [viewMode, setViewMode] = useState<'compact' | 'full' | 'row'>(
    'compact',
  )

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="max-w-full min-h-screen p-4 md:p-8 pb-0">
        <div className="flex-1 flex flex-col gap-16 w-full max-w-4xl mx-auto">
          <header className="text-center pt-8">
            <h1 className="text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mb-6">
              Enterprise Support
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Private consultation and enterprise paid support for projects of
              any size, backed by TanStack's core team
            </p>
          </header>

          {/* View Mode Toggle */}
          <div className="flex justify-center">
            <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              {(
                [
                  {
                    mode: 'compact',
                    Icon: Grid3X3,
                    title: 'Compact cards',
                    rounded: 'rounded-l-lg',
                  },
                  {
                    mode: 'full',
                    Icon: Grid2x2,
                    title: 'Full cards',
                    rounded: '',
                  },
                  {
                    mode: 'row',
                    Icon: LayoutList,
                    title: 'Row cards',
                    rounded: 'rounded-r-lg',
                  },
                ] as const
              ).map(({ mode, Icon, title, rounded }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`p-2 ${rounded} transition-colors ${
                    viewMode === mode
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                  title={title}
                >
                  <Icon className="w-5 h-5" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            <div
              className={`transition-all duration-300 ${
                viewMode === 'compact'
                  ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'
                  : viewMode === 'row'
                    ? 'flex flex-col gap-4'
                    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
              }`}
            >
              {coreMaintainers.map((maintainer, index) => (
                <div
                  key={maintainer.github}
                  className="transition-all duration-300 ease-out transform"
                  style={{
                    animationDelay: `${index * 50}ms`,
                    animation: 'fadeInUp 0.5s ease-out forwards',
                  }}
                >
                  {viewMode === 'compact' ? (
                    <CompactMaintainerCard maintainer={maintainer} />
                  ) : viewMode === 'row' ? (
                    <MaintainerRowCard maintainer={maintainer} />
                  ) : (
                    <MaintainerCard maintainer={maintainer} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-6 border border-blue-200 dark:border-blue-800">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">
                Looking for Team Training?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                We also offer professional workshops on TanStack libraries,
                delivered remotely or in-person by our creators and maintainers.
              </p>
              <Link to="/workshops">
                <Button size="sm">Learn More About Workshops</Button>
              </Link>
            </div>
          </div>

          <div className="text-center py-8 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-semibold mb-4">
              Get Unblocked, Fix Bugs, Accelerate Success
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-xl mx-auto">
              Our team will help you solve complex problems, debug tricky
              issues, and guide your project to success with expert TanStack
              knowledge.
            </p>
            <a
              href="mailto:support@tanstack.com?subject=Enterprise%20Support%20Inquiry"
              className="inline-flex items-center gap-3 px-6 py-3 bg-linear-to-r from-green-600 to-cyan-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 hover:shadow-lg hover:scale-105"
            >
              <Mail className="w-5 h-5" />
              Contact Support Team
            </a>
          </div>

          <div className="text-center max-w-lg mx-auto text-gray-500 dark:text-gray-500 text-xs pt-8 border-t border-gray-100 dark:border-gray-800">
            <p>
              For general support questions, free help is available in our{' '}
              <a
                className="text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline"
                href="https://tlinz.com/discord"
                target="_blank"
                rel="noreferrer"
              >
                Discord
              </a>{' '}
              and{' '}
              <a
                className="text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline"
                href="https://github.com/tanstack"
                target="_blank"
                rel="noreferrer"
              >
                GitHub Discussions
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
