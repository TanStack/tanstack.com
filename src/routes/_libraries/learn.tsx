import { Link } from '@tanstack/react-router'
import { LogoQueryGG } from '~/components/LogoQueryGG'
import { seo } from '~/utils/seo'
import { FaCheckCircle } from 'react-icons/fa'

export const Route = createFileRoute({
  component: LoginComp,
  head: () => ({
    meta: seo({
      title: 'Learn | TanStack',
      description: `Education and learning resources for TanStack libraries and projects`,
      keywords: `learn,course,education,learning,resources,training`,
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
                Educational Resources
              </div>
              <div className="text-xl font-normal tracking-tight text-pretty sm:text-2xl md:text-3xl lg:text-4xl/none">
                for TanStack Libraries
              </div>
            </h1>
            <p className="mx-auto max-w-[700px] text-pretty text-gray-500 md:text-xl dark:text-gray-400">
              Whether you're just getting started or looking to level up as an
              individual or team, we have resources that will help you succeed.
            </p>
          </div>
          <div className="flex w-[900px] max-w-full flex-wrap items-stretch justify-center gap-4">
            <Link
              to={'https://query.gg?s=tanstack' as string}
              target="_blank"
              className="block max-w-[300px] min-w-[300px] divide-y divide-white/30 overflow-hidden rounded-lg bg-white shadow-lg shadow-black/20 transition-all duration-200 hover:scale-105 hover:shadow-2xl hover:shadow-black/20 dark:bg-gray-800"
            >
              <LogoQueryGG className="w-full" />
              <div className="flex flex-col gap-6 p-4 pt-2 lg:p-8">
                <div className="text-center">
                  <div className="mt-2 text-sm opacity-70">
                    Created by{' '}
                    <span className="font-bold">Dominik Dorfmeister</span> and{' '}
                    <span className="font-bold">ui.dev</span>
                  </div>
                </div>

                <div className="max-w-full text-center text-sm font-bold">
                  “This is the best way to learn how to use React Query in
                  real-world applications.”
                  <div className="mt-2 text-xs italic">—Tanner Linsley</div>
                </div>

                <div className="mx-auto grid max-w-screen-lg gap-2 text-left text-xs">
                  <div className="flex items-start gap-2">
                    <span className="text-lg text-green-500">
                      <FaCheckCircle />
                    </span>
                    <div>Save time by learning with a guided approach</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-lg text-green-500">
                      <FaCheckCircle />
                    </span>
                    <div>
                      Get hands-on experience building a real-world application
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-lg text-green-500">
                      <FaCheckCircle />
                    </span>
                    <div>Never worry about data fetching again</div>
                  </div>
                </div>
              </div>
            </Link>
            <div className="flex max-w-[300px] min-w-[300px] items-center justify-center divide-y divide-white/30 overflow-hidden rounded-lg bg-white p-4 shadow-lg dark:bg-gray-800/60">
              <div className="rotate-[-5deg] text-3xl font-black opacity-20">
                More Coming Soon!
              </div>
            </div>
            {/* <Link
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
            </Link> */}
          </div>
        </div>
      </section>
    </div>
  )
}
