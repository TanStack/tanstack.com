import { Link } from '@tanstack/react-router'
import { seo } from '~/utils/seo'

export const Route = createFileRoute({
  component: SupportComp,
  head: () => ({
    meta: seo({
      title: 'Support | TanStack',
      description: `Help and support for TanStack libraries and projects`,
      keywords: `tanstack,react,reactjs,react query,react table,open source,open source software,oss,software,help,support`,
    }),
  }),
})

function SupportComp() {
  return (
    <div className="flex flex-col max-w-full min-h-screen gap-12 p-4 md:p-8 pb-0">
      <div className="flex-1 space-y-16 w-full max-w-4xl mx-auto">
        <header className="text-center pt-8">
          <h1 className="text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mb-6">
            Support
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Whether you're a solo developer or a large enterprise, we have
            solutions that will fit your needs perfectly
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to={'https://tlinz.com/discord' as string}
            target="_blank"
            className="group bg-white/80 shadow-xl shadow-gray-500/20 rounded-lg dark:border border-gray-500/20 dark:bg-black/40 dark:shadow-none overflow-hidden hover:shadow-2xl transition-shadow duration-200"
          >
            <div className="bg-linear-to-br from-discord/60 to-discord p-6 text-white">
              <h3 className="text-xl font-semibold mb-2">Discord</h3>
              <p className="text-sm text-white/80 mb-4">
                Community support and real-time help
              </p>
              <div className="flex flex-wrap gap-2">
                {['Community Support', 'Q&A', 'General Chat', 'Networking'].map(
                  (d) => (
                    <span
                      key={d}
                      className="text-xs bg-white/20 text-white rounded-md px-2 py-1"
                    >
                      {d}
                    </span>
                  )
                )}
              </div>
            </div>
          </Link>
          <Link
            to={'https://github.com/tanstack' as string}
            target="_blank"
            className="group bg-white/80 shadow-xl shadow-gray-500/20 rounded-lg dark:border border-gray-500/20 dark:bg-black/40 dark:shadow-none overflow-hidden hover:shadow-2xl transition-shadow duration-200"
          >
            <div className="bg-linear-to-br from-gray-600 to-gray-900 p-6 text-white">
              <h3 className="text-xl font-semibold mb-2">GitHub</h3>
              <p className="text-sm text-white/80 mb-4">
                Issues, discussions, and source code
              </p>
              <div className="flex flex-wrap gap-2">
                {['Bug Reports', 'Feature Requests', 'Source Code'].map((d) => (
                  <span
                    key={d}
                    className="text-xs bg-white/20 text-white rounded-md px-2 py-1"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </Link>
          <Link
            to="/paid-support"
            className="group bg-white/80 shadow-xl shadow-gray-500/20 rounded-lg dark:border border-gray-500/20 dark:bg-black/40 dark:shadow-none overflow-hidden hover:shadow-2xl transition-shadow duration-200 flex flex-column "
          >
            <div className="bg-linear-to-br from-green-600 to-cyan-600 p-6 text-white">
              <h3 className="text-xl font-semibold mb-2">Paid Support</h3>
              <p className="text-sm text-white/80 mb-4">
                Expert consultation and enterprise support
              </p>
              <div className="flex flex-wrap gap-2">
                {['Consulting', 'Enterprise Support'].map((d) => (
                  <span
                    key={d}
                    className="text-xs bg-white/20 text-white rounded-md px-2 py-1"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
