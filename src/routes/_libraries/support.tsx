import { Link } from '@tanstack/react-router'
import { seo } from '~/utils/seo'

export const Route = createFileRoute({
  component: LoginComp,
  head: () => ({
    meta: seo({
      title: 'Support | TanStack',
      description: `Help and support for TanStack libraries and projects`,
      keywords: `tanstack,react,reactjs,react query,react table,open source,open source software,oss,software,help,support`,
    }),
  }),
})

function LoginComp() {
  return (
    <div className="flex min-h-[100dvh] max-w-full flex-col">
      <section className="w-full px-8 py-12 md:py-24 lg:py-32 xl:py-48">
        <div className="flex flex-col items-center space-y-12 text-center">
          <div className="space-y-4">
            <h1 className="space-y-2">
              <div className="text-3xl font-black tracking-tight text-pretty sm:text-4xl md:text-5xl lg:text-6xl/none">
                Support
              </div>
              <div className="text-xl font-normal tracking-tight text-pretty sm:text-2xl md:text-3xl lg:text-4xl/none">
                for TanStack Libraries
              </div>
            </h1>
            <p className="mx-auto max-w-[700px] text-pretty text-gray-500 md:text-xl dark:text-gray-400">
              Whether you're a solo developer or a large enterprise, we have
              solutions that will fit your needs like a glove!
            </p>
          </div>
          <div className="flex w-[900px] max-w-full flex-wrap items-center justify-center gap-4">
            <Link
              to={'https://tlinz.com/discord' as string}
              target="_blank"
              className="from-discord/60 to-discord max-w-[300px] divide-y divide-white/30 rounded-lg bg-gradient-to-br text-white shadow-lg shadow-black/20 transition-all duration-200 hover:scale-105 hover:shadow-2xl hover:shadow-black/20"
            >
              <div className="p-4 text-center text-lg font-bold md:text-xl lg:text-2xl">
                Discord
              </div>
              <div className="flex flex-wrap gap-2 p-4">
                {['Community Support', 'Q&A', 'General Chat', 'Networking'].map(
                  (d) => (
                    <div
                      key={d}
                      className="text-discord rounded-full bg-white px-2 py-1 text-sm font-bold shadow-lg"
                    >
                      {d}
                    </div>
                  ),
                )}
              </div>
            </Link>
            <Link
              to={'https://github.com/tanstack' as string}
              target="_blank"
              className="max-w-[300px] divide-y divide-white/30 rounded-lg bg-gradient-to-br from-gray-500 to-gray-900 text-white shadow-lg shadow-black/20 transition-all duration-200 hover:scale-105 hover:shadow-2xl hover:shadow-black/20"
            >
              <div className="p-4 text-center text-lg font-bold md:text-xl lg:text-2xl">
                GitHub
              </div>
              <div className="flex flex-wrap gap-2 p-4">
                {['Bug Reports', 'Feature Requests', 'Source Code'].map((d) => (
                  <div
                    key={d}
                    className="rounded-full bg-white px-2 py-1 text-sm font-bold text-black shadow-lg"
                  >
                    {d}
                  </div>
                ))}
              </div>
            </Link>
            <Link
              to="/dedicated-support"
              className="max-w-[300px] divide-y divide-white/30 rounded-lg bg-gradient-to-br from-green-500 to-sky-500 text-white shadow-lg shadow-black/20 transition-all duration-200 hover:scale-105 hover:shadow-2xl hover:shadow-black/20"
            >
              <div className="p-4 text-center text-lg font-bold md:text-xl lg:text-2xl">
                Dedicated Support
              </div>
              <div className="flex flex-wrap gap-2 p-4">
                {['Consulting', 'Enterprise Support Contracts'].map((d) => (
                  <div
                    key={d}
                    className="rounded-full bg-white/90 px-2 py-1 text-sm font-bold shadow-lg"
                  >
                    <div className="bg-gradient-to-r from-sky-600 to-green-600 bg-clip-text text-transparent">
                      {d}
                    </div>
                  </div>
                ))}
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
