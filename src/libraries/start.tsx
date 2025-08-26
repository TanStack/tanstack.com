import { FaGithub, FaYinYang } from 'react-icons/fa'
import { Library } from '.'
import { VscPreview } from 'react-icons/vsc'
import { BiBookAlt } from 'react-icons/bi'
import { PiRocketLaunchDuotone, PiTreeStructureBold } from 'react-icons/pi'
import { TbServerBolt } from 'react-icons/tb'
import { twMerge } from 'tailwind-merge'
import { redirect } from '@tanstack/react-router'

const repo = 'tanstack/router'

const textStyles = 'text-cyan-600 dark:text-cyan-500'

export const startProject = {
  id: 'start',
  name: 'TanStack Start',
  cardStyles: `shadow-xl shadow-cyan-500/20 dark:shadow-lg dark:shadow-cyan-500/30 text-cyan-500 dark:text-white-400 border-2 border-transparent hover:border-current`,
  to: '/start',
  tagline: `Full-stack Framework powered by TanStack Router for React and Solid`,
  description: `Full-document SSR, Streaming, Server Functions, bundling and more, powered by TanStack Router and Vite - Ready to deploy to your favorite hosting provider.`,
  bgStyle: 'bg-cyan-500',
  textStyle: 'text-cyan-500',
  badge: 'beta',
  repo,
  latestBranch: 'main',
  latestVersion: 'v0',
  availableVersions: ['v0'],
  docsRoot: 'docs/start',
  colorFrom: 'from-teal-500',
  colorTo: 'to-cyan-500',
  textColor: 'text-cyan-600',
  embedEditor: 'codesandbox',
  frameworks: ['react', 'solid'],
  defaultDocs: 'framework/react/overview',
  scarfId: 'b6e2134f-e805-401d-95c3-2a7765d49a3d',
  showNetlifyUrl: true,
  // hide stackblitz until they support Async Local Storage
  hideStackblitzUrl: true,
  menu: [
    {
      icon: <BiBookAlt />,
      label: 'Docs',
      to: '/start/latest/docs/framework/react/overview',
    },
    {
      icon: <VscPreview />,
      label: 'Examples',
      to: '/start/latest/docs/framework/react/examples/start-basic',
    },
    {
      icon: <FaGithub />,
      label: 'GitHub',
      to: `https://github.com/${repo}`,
    },
  ],
  featureHighlights: [
    {
      title: 'Enterprise-Grade Routing',
      icon: (
        <PiTreeStructureBold
          className={twMerge('motion-safe:animate-pulse', textStyles)}
          style={{
            animationDuration: '5s',
            animationTimingFunction: 'ease-in-out',
          }}
        />
      ),
      description: (
        <div>
          Built on TanStack Router, Start comes pre-packed with a{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            fully type-safe and powerfully-unmatched routing system
          </span>{' '}
          that is designed to handle the beefiest of full-stack routing
          requirements with ease. Start builds on top of Router's fully inferred
          type safety to also provide type-safe full-stack APIs that keep you in
          the fast lane.
        </div>
      ),
    },
    {
      title: 'SSR, Streaming and Server RPCs',
      icon: (
        <TbServerBolt
          className={twMerge('motion-safe:animate-ping', textStyles)}
          style={{
            animationDuration: '2s',
            animationTimingFunction: 'ease-out',
          }}
        />
      ),
      description: (
        <div>
          Who said rich and interactive applications can't have it all? TanStack
          Start includes powerful capabilities for{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            full-document SSR, streaming, server functions and RPCs
          </span>
          . No more choosing between server-side rendering and top-class
          client-side interactivity. Command the server as you see fit.
        </div>
      ),
    },
    {
      title: 'Client-Side First, 100% Server Capable',
      icon: (
        <FaYinYang
          className={twMerge('motion-safe:animate-spin', textStyles)}
          style={{
            animationDuration: '10s',
            animationTimingFunction: 'ease-in-out',
          }}
        />
      ),
      description: (
        <div>
          While other frameworks continue to compromise on the client-side
          application experience we've cultivated as a front-end community over
          the years, TanStack Start stays true to the{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            client-side first developer experience,
          </span>{' '}
          while providing a{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            full-featured server-side capable system
          </span>{' '}
          that won't make you compromise on user experience.
        </div>
      ),
    },
    {
      title: 'Deploy Anywhere',
      icon: (
        <PiRocketLaunchDuotone
          className={twMerge('motion-safe:animate-bounce', textStyles)}
          style={{
            animationDuration: '2.5s',
            animationTimingFunction: 'ease-in-out',
          }}
        />
      ),
      description: (
        <div>
          TanStack Start can be{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            deployed anywhere JS can run
          </span>
          . Whether you're hosting on a traditional server, a serverless
          platform, or even a CDN, Start seamlessly builds, bundles and deploys
          your application with ease.
        </div>
      ),
    },
  ],
  handleRedirects: (href) => {
    // Redirect from /api-routes to /server-routes
    if (
      href.match(
        /\/start\/(latest|v1)\/docs\/framework\/(react|solid)\/api-routes/
      )
    ) {
      throw redirect({
        href: href.replace('/api-routes', '/server-routes'),
      })
    }
  },
} satisfies Library
