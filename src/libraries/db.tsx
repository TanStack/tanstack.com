import { BiBookAlt } from 'react-icons/bi'
import { BsCollectionFill } from 'react-icons/bs'
import { FaBolt, FaCogs, FaGithub } from 'react-icons/fa'
import { VscPreview } from 'react-icons/vsc'
import { twMerge } from 'tailwind-merge'
import { Library } from '.'

const repo = 'tanstack/db'

const textStyles = `text-orange-600 dark:text-orange-500`

export const dbProject = {
  id: 'db',
  name: 'TanStack DB',
  cardStyles: `border-orange-500/25 dark:border-orange-500/25 text-orange-500 dark:text-orange-500 border-2`,
  to: '/db',
  tagline: `A reactive client store for building super fast apps on sync`,
  description: `TanStack DB extends TanStack Query with collections, live queries and optimistic mutations that keep your UI reactive, consistent and blazing fast 🔥`,
  ogImage: 'https://github.com/tanstack/db/raw/main/media/repo-header.png',
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
  frameworks: ['react', 'vue'],
  scarfId: '302d0fef-cb3f-43c6-b45c-f055b9745edb',
  defaultDocs: 'overview',
  menu: [
    {
      icon: <BiBookAlt />,
      label: 'Docs',
      to: '/db/latest/docs',
    },
    {
      icon: <VscPreview />,
      label: 'Examples',
      to: '/db/latest/docs/framework/react/examples/todo',
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
      icon: <BsCollectionFill className={twMerge(textStyles)} />,
      description: (
        <div>
          Collections are typed sets of objects. Sync or load data into them.
          Query across them with live queries and write locally to them using
          optimistic mutations.
        </div>
      ),
    },
    {
      title: 'Live Queries',
      icon: <FaBolt className={twMerge(textStyles)} />,
      description: (
        <div>
          Live queries run reactively against and across collections. They're
          super fast, powered by differential dataflow, with support for joins,
          filters and aggregates.
        </div>
      ),
    },
    {
      title: 'Optimistic mutations',
      icon: <FaCogs className={twMerge(textStyles)} />,
      description: (
        <div>
          Batch and stage instant local changes across collections. Sync
          transactions to the backend with automatic management of rollbacks and
          optimistic state.
        </div>
      ),
    },
  ],
} satisfies Library
