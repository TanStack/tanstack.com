import { createFileRoute, Link } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { Card } from '~/components/Card'
import { seo } from '~/utils/seo'
import { Rss, BookOpen, Github } from 'lucide-react'
import { BrandXIcon } from '~/components/icons/BrandXIcon'
import { YouTubeIcon } from '~/components/icons/YouTubeIcon'

export const Route = createFileRoute('/feed')({
  component: RouteComp,
  head: () => ({
    meta: seo({
      title: 'TanStack Feed',
      description:
        'The TanStack release feed has been retired. Find release notes, announcements, and updates on GitHub and our blog.',
    }),
  }),
})

const alternatives = [
  {
    title: 'Blog',
    icon: BookOpen,
    gradient: 'from-blue-500 to-cyan-500',
    borderColor: 'hover:border-blue-500/50',
    description:
      'In-depth posts on new releases, design decisions, and what we are building next.',
    href: '/blog',
    label: 'Read the blog',
    internal: true,
  },
  {
    title: 'GitHub Releases',
    icon: Github,
    gradient: 'from-gray-600 to-gray-800',
    borderColor: 'hover:border-gray-500/50',
    description:
      'Every library publishes detailed changelogs and release notes directly on GitHub.',
    href: 'https://github.com/TanStack',
    label: 'View on GitHub',
    internal: false,
  },
  {
    title: 'X',
    icon: BrandXIcon,
    gradient: 'from-sky-400 to-blue-500',
    borderColor: 'hover:border-sky-500/50',
    description:
      'Follow @tan_stack for announcements, early previews, and release highlights.',
    href: 'https://x.com/tan_stack',
    label: 'Follow on X',
    internal: false,
  },
  {
    title: 'YouTube',
    icon: YouTubeIcon,
    gradient: 'from-red-500 to-red-700',
    borderColor: 'hover:border-red-500/50',
    description:
      'Tutorials, deep dives, and release walkthroughs on the official TanStack channel.',
    href: 'https://youtube.com/@tan_stack',
    label: 'Subscribe on YouTube',
    internal: false,
  },
]

function RouteComp() {
  return (
    <div className="flex flex-col max-w-full min-h-screen gap-12 p-4 md:p-8 pb-0">
      <div className="flex-1 space-y-12 w-full max-w-3xl mx-auto">
        <header className="flex items-start gap-4">
          <div className="shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center">
            <Rss className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black">The Feed is Gone</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              This feature has been retired.
            </p>
          </div>
        </header>

        <Card as="section" className="p-6 md:p-8">
          <p className="text-lg leading-relaxed">
            The TanStack release feed was an experiment in aggregating GitHub
            releases and blog posts into a single stream. After running it for a
            while, it became clear the maintenance cost outweighed the value it
            added. The data was often stale, the sync logic was brittle, and the
            same content was already available in better, more canonical places.
          </p>
          <p className="text-lg leading-relaxed mt-4">
            Rather than keep a half-working feature alive, we removed it. The
            information you were looking for lives in the places listed below,
            where it is always up to date.
          </p>
        </Card>

        <section className="space-y-4">
          <h2 className="text-xl font-bold">Where to find updates instead</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {alternatives.map((alt) => {
              const Icon = alt.icon
              return (
                <Card
                  key={alt.title}
                  as="div"
                  className={`p-5 flex flex-col gap-3 transition-colors ${alt.borderColor}`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg bg-gradient-to-br ${alt.gradient} flex items-center justify-center`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold mb-1">{alt.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {alt.description}
                    </p>
                  </div>
                  {alt.internal ? (
                    <Link
                      to={alt.href as '/blog'}
                      className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {alt.label} &rarr;
                    </Link>
                  ) : (
                    <a
                      href={alt.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {alt.label} &rarr;
                    </a>
                  )}
                </Card>
              )
            })}
          </div>
        </section>
      </div>
      <Footer />
    </div>
  )
}
