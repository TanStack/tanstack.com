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
    <div className="flex flex-col min-h-[100dvh] max-w-full">
      <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 px-8">
        <div className="flex flex-col items-center space-y-12 text-center ">
          <div className="space-y-4">
            <h1 className="space-y-2">
              <div className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl lg:text-6xl/none text-pretty">
                Support
              </div>
              <div className="text-xl font-normal tracking-tight sm:text-2xl md:text-3xl lg:text-4xl/none text-pretty">
                for TanStack Libraries
              </div>
            </h1>
            <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400 text-pretty">
              Whether you're a solo developer or a large enterprise, we have
              solutions that will fit your needs like a glove!
            </p>
          </div>
          <div className="flex items-center flex-wrap gap-4 max-w-full w-[900px] justify-center">
            <Link
              to={'https://tlinz.com/discord' as string}
              target="_blank"
              className="max-w-[300px] rounded-lg bg-gradient-to-br from-discord/60 to-discord text-white shadow-black/20 shadow-lg hover:shadow-2xl hover:shadow-black/20 divide-y divide-white/30 transition-all duration-200 hover:scale-105"
            >
              <div className="p-4 text-lg md:text-xl lg:text-2xl font-bold text-center">
                Discord
              </div>
              <div className="p-4 flex gap-2 flex-wrap">
                {['Community Support', 'Q&A', 'General Chat', 'Networking'].map(
                  (d) => (
                    <div
                      key={d}
                      className="text-sm bg-white text-discord rounded-full py-1 px-2 shadow-lg font-bold"
                    >
                      {d}
                    </div>
                  )
                )}
              </div>
            </Link>
            <Link
              to={'https://github.com/tanstack' as string}
              target="_blank"
              className="max-w-[300px] rounded-lg bg-gradient-to-br from-gray-500 to-gray-900 text-white shadow-black/20 shadow-lg hover:shadow-2xl hover:shadow-black/20 divide-y divide-white/30 transition-all duration-200 hover:scale-105"
            >
              <div className="p-4 text-lg md:text-xl lg:text-2xl font-bold text-center">
                GitHub
              </div>
              <div className="p-4 flex gap-2 flex-wrap">
                {['Bug Reports', 'Feature Requests', 'Source Code'].map((d) => (
                  <div
                    key={d}
                    className="text-sm bg-white text-black rounded-full py-1 px-2 shadow-lg font-bold"
                  >
                    {d}
                  </div>
                ))}
              </div>
            </Link>
            <Link
              to="/dedicated-support"
              className="max-w-[300px] rounded-lg bg-gradient-to-br from-green-500 to-sky-500 text-white shadow-black/20 shadow-lg hover:shadow-2xl hover:shadow-black/20 divide-y divide-white/30 transition-all duration-200 hover:scale-105"
            >
              <div className="p-4 text-lg md:text-xl lg:text-2xl font-bold text-center">
                Dedicated Support
              </div>
              <div className="p-4 flex gap-2 flex-wrap">
                {['Consulting', 'Enterprise Support Contracts'].map((d) => (
                  <div
                    key={d}
                    className="text-sm bg-white/90 rounded-full py-1 px-2 shadow-lg font-bold"
                  >
                    <div className="text-transparent bg-clip-text bg-gradient-to-r to-green-600 from-sky-600">
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
