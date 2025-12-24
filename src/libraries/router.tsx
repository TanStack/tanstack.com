import {
  Book,
  DatabaseZap,
  MessageCircleQuestionMark,
  PlugZap,
  Wallpaper,
} from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { redirect } from '@tanstack/react-router'
import { GithubIcon } from '~/components/icons/GithubIcon'

const repo = 'tanstack/router'

const textStyles = 'text-emerald-500 dark:text-emerald-400'

export const routerProject = {
  id: 'router',
  name: 'TanStack Router',
  cardStyles: twMerge(
    `shadow-xl shadow-emerald-700/20 dark:shadow-lg dark:shadow-emerald-500/30 ${textStyles} border-2 border-transparent hover:border-current`,
  ),
  to: '/router',
  tagline: `Type-safe Routing for React and Solid applications`,
  description: `A powerful React router for client-side and full-stack react applications. Fully type-safe APIs, first-class search-params for managing state in the URL and seamless integration with the existing React ecosystem.`,
  ogImage: 'https://github.com/tanstack/router/raw/main/media/header.png',
  bgStyle: 'bg-emerald-500',
  textStyle: textStyles,
  badge: undefined,
  repo,
  latestBranch: 'main',
  latestVersion: 'v1',
  availableVersions: ['v1'],
  docsRoot: 'docs/router',
  bgRadial: 'from-emerald-500 via-lime-600/50 to-transparent',
  colorFrom: 'from-emerald-500',
  colorTo: 'to-lime-600',
  textColor: textStyles,
  frameworks: ['react', 'solid'],
  scarfId: '3d14fff2-f326-4929-b5e1-6ecf953d24f4',
  defaultDocs: 'framework/react/overview',
  installPath: 'framework/$framework/installation',
  legacyPackages: ['react-location'],
  hideCodesandboxUrl: true,
  showVercelUrl: false,
  showNetlifyUrl: true,
  showCloudflareUrl: true,
  menu: [
    {
      icon: <Book />,
      label: 'Docs',
      to: '/router/latest/docs/framework/react/overview',
    },
    {
      icon: <Wallpaper />,
      label: 'Examples',
      to: '/router/latest/docs/framework/react/examples/kitchen-sink-file-based',
    },
    {
      icon: <GithubIcon />,
      label: 'GitHub',
      to: `https://github.com/${repo}`,
    },
  ],
  testimonials: [
    {
      quote:
        "The biggest problem with TanStack Router is that once you've worked with it, you'll have a harder time going back to other routing solutions.",
      author: 'Dominik (TkDodo)',
      role: '@TkDodo',
      company: 'TanStack',
    },
    {
      quote:
        "TanStack Router lives and breathes TypeScript - it's meant for it, they are a perfect match.",
      author: 'Dominik (TkDodo)',
      role: '@TkDodo',
      company: 'TanStack',
    },
    {
      quote:
        'I took a few hours to switch to the file-based generation and was very impressed. Then I used auto codesplitting and was blown away. This is absolutely phenomenal!',
      author: 'GitHub User',
      role: 'Migration Thread',
      company: 'TanStack Community',
    },
    {
      quote:
        'The more I use React + Vite + TanStack Router + TypeScript + TanStack Query, the more I love it.',
      author: 'Catalin Pit',
      role: '@catalinmpit',
      company: 'Developer Advocate',
    },
    {
      quote:
        'I just got Elysia to work with TanStack Router, amazing dx so far..',
      author: 'An Le',
      role: '@anlett10',
      company: 'Developer',
    },
    {
      quote:
        "I've been using Tanstack Start for a new project and it's super good. The server functions completely replace the need for TRPC/GraphQL/REST.",
      author: 'Developer',
      role: 'TanStack Community',
      company: '',
    },
  ],
  featureHighlights: [
    {
      title: 'Typesafe & powerful, yet familiarly simple',
      icon: <PlugZap className={twMerge('scale-125', textStyles)} />,
      description: (
        <div>
          TanStack Router builds on modern routing patterns made popular by
          other tools, but has been re-engineered from the ground up to be{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            100% typesafe without compromising on DX
          </span>
          . You <em>can</em> have your cake and eat it too!
        </div>
      ),
    },
    {
      title: 'Built-in Data Fetching with Caching',
      icon: (
        <DatabaseZap
          className={twMerge('motion-safe:animate-spin', textStyles)}
          style={{
            animationDuration: '3s',
            animationTimingFunction: 'ease-in-out',
          }}
        />
      ),
      description: (
        <div>
          Hoist your data fetching and avoid waterfalls with TanStack Router's
          loader API and get{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            instant navigations with built-in caching and automatic preloading
          </span>
          . Need something more custom? Router's API is designed to work with
          your favorite client-side cache libraries!
        </div>
      ),
    },
    {
      title: 'Search Param APIs to make your state-manager jealous',
      icon: <MessageCircleQuestionMark className={twMerge('', textStyles)} />,
      description: (
        <div>
          Instead of throwing you to the URLSearchParam wolves, TanStack Router
          outfits you with state-manager-grade search param APIs. With{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            schemas, validation, full type-safety and pre/post manipulation
          </span>
          , you can manage your state in the URL and easily sync it to your
          state-manager of choice.
        </div>
      ),
    },
  ],
  handleRedirects(href) {
    if (href.includes('router/latest/docs/framework/react/start')) {
      throw redirect({
        href: href.replace(
          'router/latest/docs/framework/react/start',
          'start/latest/docs/framework/react',
        ),
      })
    }

    if (href.includes('/router/latest/docs/framework/react/examples/start')) {
      throw redirect({
        href: href.replace(
          'router/latest/docs/framework/react/examples/start',
          'start/latest/docs/framework/react/examples/start',
        ),
      })
    }
  },
}
