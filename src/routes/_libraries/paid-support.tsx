import { Link } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { HiOutlineMail } from 'react-icons/hi'
import { useScript } from '~/hooks/useScript'
import { coreMaintainers } from '~/libraries/maintainers'
import { CompactMaintainerCard } from '~/components/MaintainerCard'

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
  useScript({
    id: 'hs-script-loader',
    async: true,
    defer: true,
    src: '//js-na1.hs-scripts.com/45982155.js',
  })

  return (
    <div className="flex flex-col max-w-full min-h-screen gap-12 p-4 md:p-8 pb-0">
      <div className="flex-1 space-y-16 w-full max-w-4xl mx-auto">
        <header className="text-center pt-8">
          <h1 className="text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mb-6">
            Paid Support
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Private consultation and enterprise paid support for projects of any
            size, backed by TanStack's core team
          </p>
        </header>

        <div className="space-y-8">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
            {coreMaintainers.map((maintainer) => (
              <CompactMaintainerCard
                key={maintainer.github}
                maintainer={maintainer}
              />
            ))}
          </div>
        </div>

        <div className="text-center py-8 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold mb-4">
            Get Unblocked, Fix Bugs, Accelerate Success
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-xl mx-auto">
            Our team will help you solve complex problems, debug tricky issues,
            and guide your project to success with expert TanStack knowledge.
          </p>
          <a
            href="mailto:support@tanstack.com?subject=Paid%20Support%20Inquiry"
            className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-green-600 to-cyan-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 hover:shadow-lg hover:scale-105"
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
  )
}
