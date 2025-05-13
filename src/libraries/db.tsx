import { VscPreview, VscWand } from 'react-icons/vsc'
import { Library } from '.'
import { FaGithub, FaBolt, FaCogs } from 'react-icons/fa'
import { BiBookAlt } from 'react-icons/bi'
import { twMerge } from 'tailwind-merge'

const repo = 'tanstack/db'

const textStyles = `text-orange-600 dark:text-orange-500`

export const dbProject = {
  id: 'db',
  name: 'TanStack DB',
  cardStyles: `shadow-xl shadow-orange-700/20 dark:shadow-lg dark:shadow-orange-500/20 text-orange-500 dark:text-orange-400 border-2 border-transparent hover:border-current`,
  to: '/db',
  tagline: `A reactive client store for building super fast apps on sync`,
  description: `TanStack DB extends TanStack Query with collections, live queries and optimistic mutations that keep your UI reactive, consistent and blazing fast 🔥`,
  ogImage:
    'https://github.com/tanstack/db/raw/main/media/repo-header.png',
  badge: 'soon',
  bgStyle: `bg-orange-700`,
  textStyle: `text-orange-500`,
  repo,
  latestBranch: 'main',
  latestVersion: 'v0',
  availableVersions: ['v0'],
  colorFrom: `from-orange-500`,
  colorTo: `to-orange-700`,
  textColor: `text-orange-700`,
  frameworks: ['react', 'solid'],
  scarfId: '302d0fef-cb3f-43c6-b45c-f055b9745edb',
  defaultDocs: 'overview',
  menu: [
    {
      icon: <VscPreview />,
      label: 'Examples',
      to: '/db/latest/docs/framework/react/examples/simple',
    },
    {
      icon: <BiBookAlt />,
      label: 'Docs',
      to: '/db/latest/docs',
    },
    {
      icon: <FaGithub />,
      label: 'Github',
      to: `https://github.com/${repo}`,
    },
  ],
  featureHighlights: [
    {
      title: 'Collections',
      icon: <VscWand className={twMerge(textStyles)} />,
      description: (
        <div>Typed sets of objects that can mirror a backend table or be populated with a filtered view or result set, such as <code>pendingTodos</code> or <code>decemberNewTodos</code>.
          Collections are just JavaScript data — load them on demand and define as many as you need.
        </div>
      ),
    },
    {
      title: 'Live Queries',
      icon: <FaBolt className={twMerge(textStyles)} />,
      description: (
        <div>Queries run reactively against and across collections with support for joins, filters and aggregates. They're powered by differential dataflow: query results update incrementally, not by re-running the whole query.</div>
      ),
    },
    {
      title: 'Transactional mutators',
      icon: <FaCogs className={twMerge(textStyles)} />,
      description: (
        <div>Batch and stage local changes across collections with immediate application of local optimistic updates. Then sync transactions to the backend with automatic rollbacks and management of optimistic state.</div>
      ),
    },
  ],
} satisfies Library
