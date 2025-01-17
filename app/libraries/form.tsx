import { VscPreview, VscWand } from 'react-icons/vsc'
import { Library } from '.'
import { FaGithub, FaBolt, FaCogs } from 'react-icons/fa'
import { BiBookAlt } from 'react-icons/bi'
import { twMerge } from 'tailwind-merge'

const repo = 'tanstack/form'

const textStyles = 'text-yellow-600 dark:text-yellow-300'

export const formProject = {
  id: 'form',
  name: 'TanStack Form',
  cardStyles: `shadow-xl shadow-yellow-700/20 dark:shadow-lg dark:shadow-yellow-500/30 text-yellow-500 border-2 border-transparent hover:border-current`,
  to: '/form',
  tagline: `Headless UI for building performant and type-safe forms`,
  description: `Headless, performant, and type-safe form state management for TS/JS, React, Vue, Angular, Solid and Lit`,
  ogImage: 'https://github.com/tanstack/form/raw/main/media/repo-header.png',
  badge: 'new',
  bgStyle: 'bg-yellow-500',
  textStyle: 'text-yellow-500',
  repo,
  latestBranch: 'main',
  latestVersion: 'v0',
  availableVersions: ['v0'],
  colorFrom: 'from-yellow-500',
  colorTo: 'to-yellow-600',
  textColor: 'text-yellow-600',
  frameworks: ['react', 'vue', 'angular', 'solid', 'lit'],
  scarfId: '72ec4452-5d77-427c-b44a-57515d2d83aa',
  menu: [
    {
      icon: <VscPreview />,
      label: 'Examples',
      to: '/form/latest/docs/framework/react/examples/simple',
    },
    {
      icon: <BiBookAlt />,
      label: 'Docs',
      to: '/form/latest/docs',
    },
    {
      icon: <FaGithub />,
      label: 'Github',
      to: `https://github.com/${repo}`,
    },
  ],
  featureHighlights: [
    {
      title: 'First-Class TypeScript Support',
      icon: <VscWand className="text-yellow-400" />,
      description: (
        <div>
          TanStack Form touts first-class TypeScript support with outstanding
          autocompletion, excellent generic throughput and inferred types
          everywhere possible.{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            This results in fewer runtime errors, increased code
            maintainability, and a smoother development experience
          </span>{' '}
          to help you confidently build robust and type-safe form solutions that
          scale.
        </div>
      ),
    },
    {
      title: 'Headless and Framework Agnostic',
      icon: <FaBolt className="text-yellow-500" />,
      description: (
        <div>
          Form's headless and framework agnostic approach ensures maximum
          flexibility and broad compatibility with many front-end frameworks, or
          no framework at all. By both supplying and encouraging a headless
          approach to your forms, building custom reusable form components
          tailored to your application's needs{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            requires little abstraction and keeps your code modular, simple and
            composable.
          </span>
        </div>
      ),
    },
    {
      title: 'Granular Reactive Performance',
      icon: <FaCogs className="text-amber-500" />,
      description: (
        <div>
          When it comes to performance, TanStack Form delivers amazing speed and
          control, but without the cruft, boilerplate, or abstractions. With
          granularly reactive APIs at its core,{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            only relevant components are updated when the form state changes.
          </span>{' '}
          The end result? A faster UI, happy users, and zero worries about
          performance.
        </div>
      ),
    },
  ],
} satisfies Library
