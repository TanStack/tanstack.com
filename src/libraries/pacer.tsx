import { VscPreview, VscWand } from 'react-icons/vsc'
import { Library } from '.'
import { FaGithub, FaBolt, FaCogs } from 'react-icons/fa'
import { BiBookAlt } from 'react-icons/bi'
import { twMerge } from 'tailwind-merge'

const repo = 'tanstack/pacer'

const textStyles = `text-lime-600 dark:text-lime-500`

export const pacerProject = {
  id: 'pacer',
  name: 'TanStack Pacer',
  cardStyles: `shadow-xl shadow-lime-700/20 dark:shadow-lg dark:shadow-lime-500/20 text-lime-500 dark:text-lime-400 border-2 border-transparent hover:border-current`,
  to: '/pacer',
  tagline: `Framework agnostic debouncing, throttling, and queueing utilities`,
  description: `Set the pace of interactions in your applications. Limit the rate at which functions can fire, or intelligently queue long-running tasks with Concurrency Control.`,
  ogImage: 'https://github.com/tanstack/pacer/raw/main/media/repo-header.png',
  badge: 'alpha',
  bgStyle: `bg-lime-700`,
  textStyle: `text-lime-500`,
  repo,
  latestBranch: 'main',
  latestVersion: 'v0',
  availableVersions: ['v0'],
  colorFrom: `from-lime-500`,
  colorTo: `to-lime-700`,
  textColor: `text-lime-700`,
  frameworks: ['react', 'solid'],
  scarfId: '302d0fef-cb3f-43c6-b45c-f055b9745edb',
  defaultDocs: 'overview',
  menu: [
    {
      icon: <BiBookAlt />,
      label: 'Docs',
      to: '/pacer/latest/docs',
    },
    {
      icon: <VscPreview />,
      label: 'Examples',
      to: '/pacer/latest/docs/framework/react/examples/debounce',
    },
    {
      icon: <FaGithub />,
      label: 'Github',
      to: `https://github.com/${repo}`,
    },
  ],
  featureHighlights: [
    {
      title: 'Framework Agnostic & Type-Safe',
      icon: <VscWand className={twMerge(textStyles)} />,
      description: (
        <div>
          TanStack Pacer provides an intuitive and flexible API that works
          across any JavaScript framework.{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            Every utility is fully type-safe with reactive framework adapters
          </span>{' '}
          that seamlessly connect to your state management of choice. Choose
          from multiple layers of abstraction to confidently control timing in
          your applications.
        </div>
      ),
    },
    {
      title: 'Flexible Rate Limiting Controls',
      icon: <FaBolt className={twMerge(textStyles)} />,
      description: (
        <div>
          Take control of your application's timing with powerful utilities for{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            rate limiting, throttling, and debouncing
          </span>
          . Leverage built-in cleanup and cancellation capabilities to help you
          manage execution timing with precision while preventing memory leaks.
          Flexible configuration options let you fine-tune the behavior to match
          your needs.
        </div>
      ),
    },
    {
      title: 'Async/Sync Queue Management',
      icon: <FaCogs className={twMerge(textStyles)} />,
      description: (
        <div>
          Handle complex asynchronous workflows with intelligent queuing and
          concurrency control.{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            Manage long-running tasks with FIFO/LIFO ordering, priority queuing,
            and parallel execution
          </span>
          . Built-in pause, resume and cancel capabilities give you complete
          control over your queue's lifecycle. Perfect for managing API calls,
          animations, and other sequential operations.
        </div>
      ),
    },
  ],
} satisfies Library
