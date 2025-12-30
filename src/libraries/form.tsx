import { Book, Wallpaper, WandSparkles, Zap } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { GithubIcon } from '~/components/icons/GithubIcon'
import { CogsIcon } from '~/components/icons/CogsIcon'

const repo = 'tanstack/form'

const textStyles = 'text-yellow-600 dark:text-yellow-300'

export const formProject = {
  id: 'form',
  name: 'TanStack Form',
  cardStyles: `text-yellow-500 hover:border-current`,
  to: '/form',
  tagline: `Headless UI for building performant and type-safe forms`,
  description: `Headless, performant, and type-safe form state management for TS/JS, React, Vue, Angular, Solid, Lit and Svelte.`,
  ogImage: 'https://github.com/tanstack/form/raw/main/media/repo-header.png',
  badge: 'new',
  bgStyle: 'bg-yellow-500',
  textStyle: 'text-yellow-500',
  repo,
  latestBranch: 'main',
  latestVersion: 'v1',
  availableVersions: ['v1'],
  bgRadial: 'from-yellow-500 via-yellow-600/50 to-transparent',
  colorFrom: 'from-yellow-500',
  colorTo: 'to-yellow-600',
  textColor: 'text-yellow-600',
  frameworks: ['react', 'vue', 'angular', 'solid', 'lit', 'svelte'],
  scarfId: '72ec4452-5d77-427c-b44a-57515d2d83aa',
  menu: [
    {
      icon: <Book />,
      label: 'Docs',
      to: '/form/latest/docs',
    },
    {
      icon: <Wallpaper />,
      label: 'Examples',
      to: '/form/latest/docs/framework/react/examples/simple',
    },
    {
      icon: <GithubIcon />,
      label: 'Github',
      to: `https://github.com/${repo}`,
    },
  ],
  testimonials: [
    {
      quote:
        'TanStack Form is a new headless form library that makes building more complex and interactive forms easy. Given the high quality of all the other libraries in the TanStack suite, I was excited to give this new form library a try.',
      author: 'This Dot Labs',
      role: '@ThisDotLabs',
      company: 'This Dot',
    },
    {
      quote:
        'It seemed like an interesting library with its simple APIs so I started studying it. Having fun helping Form get to 1.0.',
      author: 'Leonardo Montini',
      role: '@DevLeonardo',
      company: 'TanStack Maintainer',
    },
    {
      quote:
        'First-class TypeScript support with outstanding autocompletion, excellent generic throughput and inferred types everywhere possible.',
      author: 'TanStack Form Docs',
      role: 'Official',
      company: 'TanStack',
    },
  ],
  featureHighlights: [
    {
      title: 'First-Class TypeScript Support',
      icon: <WandSparkles className="text-yellow-400" />,
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
      icon: <Zap className="text-yellow-500" />,
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
      icon: <CogsIcon className="text-amber-500" />,
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
}
