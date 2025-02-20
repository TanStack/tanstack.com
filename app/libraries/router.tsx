import { FaGithub } from 'react-icons/fa'
import { Library } from '.'
import { VscPreview } from 'react-icons/vsc'
import { BiBookAlt } from 'react-icons/bi'
import { RiLightbulbFlashLine } from 'react-icons/ri'
import { CgTimelapse } from 'react-icons/cg'
import { TbZoomQuestion } from 'react-icons/tb'
import { twMerge } from 'tailwind-merge'
import { redirect } from '@tanstack/react-router'

const repo = 'tanstack/router'

const textStyles = 'text-emerald-500 dark:text-emerald-400'

export const routerProject = {
  id: 'router',
  name: 'TanStack Router',
  cardStyles: twMerge(
    `shadow-xl shadow-emerald-700/20 dark:shadow-lg dark:shadow-emerald-500/30 ${textStyles} border-2 border-transparent hover:border-current`
  ),
  to: '/router',
  tagline: `Type-safe Routing for React applications.`,
  description: `A powerful React router for client-side and full-stack react applications. Fully type-safe APIs, first-class search-params for managing state in the URL and seamless integration with the existing React ecosystem.`,
  ogImage: 'https://github.com/tanstack/router/raw/main/media/header.png',
  bgStyle: 'bg-emerald-500',
  textStyle: textStyles,
  badge: 'new',
  repo,
  latestBranch: 'main',
  latestVersion: 'v1',
  availableVersions: ['v1'],
  docsRoot: 'docs/router',
  colorFrom: 'from-emerald-500',
  colorTo: 'to-lime-600',
  textColor: textStyles,
  frameworks: ['react', 'solid'],
  scarfId: '3d14fff2-f326-4929-b5e1-6ecf953d24f4',
  defaultDocs: 'framework/react/overview',
  hideCodesandboxUrl: true,
  showVercelUrl: false,
  showNetlifyUrl: true,
  menu: [
    {
      icon: <VscPreview />,
      label: 'Examples',
      to: '/router/latest/docs/framework/react/examples/kitchen-sink-file-based',
    },
    {
      icon: <BiBookAlt />,
      label: 'Docs',
      to: '/router/latest/docs/framework/react/overview',
    },
    {
      icon: <FaGithub />,
      label: 'GitHub',
      to: `https://github.com/${repo}`,
    },
  ],
  featureHighlights: [
    {
      title: 'Typesafe & powerful, yet familiarly simple',
      icon: (
        <RiLightbulbFlashLine className={twMerge('scale-125', textStyles)} />
      ),
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
        <CgTimelapse
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
      icon: <TbZoomQuestion className={twMerge('', textStyles)} />,
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
          'start/latest/docs/framework/react'
        ),
      })
    }

    if (href.includes('/router/latest/docs/framework/react/examples/start')) {
      throw redirect({
        href: href.replace(
          'router/latest/docs/framework/react/examples/start',
          'start/latest/docs/framework/react/examples/start'
        ),
      })
    }
  },
} satisfies Library
