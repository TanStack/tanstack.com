import {
  BracketsCurlyIcon,
  LightningIcon,
  GearIcon,
} from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import { table } from './libraries'

const textStyles = 'text-category-ui'

export const tableProject = {
  ...table,
  description: `Headless, type-safe table and data-grid infrastructure with feature-level tree shaking, reactive state, fast row models, and adapters for React, Preact, Vue, Solid, Svelte, Angular, Ember, Lit, Alpine, and Octane.`,
  latestBranch: 'main',
  defaultDocs: 'introduction',
  legacyPackages: ['react-table'],
  testimonials: [
    {
      quote:
        'Introducing Table and Data Table components. Powered by TanStack Table. With Pagination, Row Selection, Sorting, Filters, Row Actions and Keyboard Navigation.',
      author: 'shadcn',
      role: '@shadcn',
      company: 'Vercel',
    },
    {
      quote:
        'I made a version using React Aria Components with arrow key navigation, multi selection, screen reader announcements, and more. Works great with TanStack Table too!',
      author: 'Devon Govett',
      role: '@devongovett',
      company: 'Adobe',
    },
    {
      quote:
        'TanStack Table is the perfect choice if you need a lightweight, unopinionated, and fully customizable solution. It gives you the power and leaves the presentation up to you.',
      author: 'Developer Review',
      role: 'Community',
      company: '',
    },
    {
      quote:
        "Linear-style table filters using shadcn and TanStack Table. Open source. You'll be able to use this as an add-on to the Data Table component.",
      author: 'Kian Bazza',
      role: '@kianbazza',
      company: 'Developer',
    },
  ],
  featureHighlights: [
    {
      title: '100% Control',
      icon: (
        <div className="text-center overflow-hidden">
          <BracketsCurlyIcon className={twMerge(textStyles)} />
        </div>
      ),
      description: (
        <div>
          TanStack Table provides the state, row processing, and typed APIs
          without prescribing your markup or styles. Having 100% control of your
          code matters more than ever.{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            Your semantics, components, design system, interactions, and source
            code stay yours. Use any component library or design system,
            including your own.
          </span>
        </div>
      ),
    },
    {
      title: 'Reactive by Design',
      icon: <LightningIcon className={twMerge(textStyles)} />,
      description: (
        <div>
          Every registered state slice is backed by TanStack Store, whose
          fine-grained reactivity is built on alien-signals. Read a selected
          snapshot, subscribe exactly where state is rendered, or own a slice
          with an external atom.{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            Fine-grained reactivity keeps unrelated parts of a large table out
            of the render path.
          </span>
        </div>
      ),
    },
    {
      title: 'Built to Extend',
      icon: <GearIcon className={twMerge(textStyles)} />,
      description: (
        <div>
          Custom features use the same extension points as Table's built-ins.
          Compose shared options with tableOptions, build app-level table
          systems with createTableHook, and inspect live instances with the
          supported Devtools integration.{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            Scale from one headless table to a typed table platform for your
            whole product.
          </span>
        </div>
      ),
    },
  ],
}
