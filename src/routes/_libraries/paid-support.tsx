import { seo } from '~/utils/seo'
import { HiOutlineMail } from 'react-icons/hi'
import { MdViewList, MdViewModule, MdFormatListBulleted } from 'react-icons/md'
import { useState } from 'react'
import { useScript } from '~/hooks/useScript'
import { coreMaintainers } from '~/libraries/maintainers'
import {
  CompactMaintainerCard,
  MaintainerCard,
  MaintainerRowCard,
} from '~/components/MaintainerCard'

export const Route = createFileRoute({
  component: PaidSupportComp,
  staleTime: Infinity,
  head: () => ({
    meta: seo({
      title: 'Paid Support | TanStack',
      description: `Private consultation and enterprise paid support for projects of any size.`,
      // Keywords to target support for all sizes of companies, including consulting and enterprise paid support
      keywords:
        'tanstack,react,reactjs,react query,react table,open source,open source software,oss,software,consulting,enterprise support,paid support',
    }),
  }),
})

function PaidSupportComp() {
  const [viewMode, setViewMode] = useState<'compact' | 'full' | 'row'>(
    'compact'
  )

  useScript({
    id: 'hs-script-loader',
    async: true,
    defer: true,
    src: '//js-na1.hs-scripts.com/45982155.js',
  })

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
              Paid Support
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Private consultation and enterprise paid support for projects of
              any size, backed by TanStack's core team
            </p>
          </header>

          {/* View Mode Toggle */}
          <div className="flex justify-center">
            <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <button
                onClick={() => setViewMode('compact')}
                className={`p-2 rounded-l-lg transition-colors ${
                  viewMode === 'compact'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
                title="Compact cards"
              >
                <MdViewList className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('full')}
                className={`p-2 transition-colors ${
                  viewMode === 'full'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
                title="Full cards"
              >
                <MdViewModule className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('row')}
                className={`p-2 rounded-r-lg transition-colors ${
                  viewMode === 'row'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
                title="Row cards"
              >
                <MdFormatListBulleted className="w-5 h-5" />
              </button>
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

          <div className="text-center py-8 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-semibold mb-4">
              Get Unblocked, Fix Bugs, Accelerate Success
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-xl mx-auto">
              Our team will help you solve complex problems, debug tricky
              issues, and guide your project to success with expert TanStack
              knowledge.
            </p>
            <a
              href="mailto:support@tanstack.com?subject=Paid%20Support%20Inquiry"
              className="inline-flex items-center gap-3 px-6 py-3 bg-linear-to-r from-green-600 to-cyan-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 hover:shadow-lg hover:scale-105"
            >
              <HiOutlineMail className="w-5 h-5" />
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
