import { GalleryVerticalEnd, Zap } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { CogsIcon } from '~/components/icons/CogsIcon'

const repo = 'tanstack/db'

const textStyles = `text-orange-600 dark:text-orange-500`

export const dbProject = {
  id: 'db',
  name: 'TanStack DB',
  cardStyles: `text-orange-500 dark:text-orange-400 hover:border-current`,
  to: '/db',
  tagline: `The reactive client-first store for your API`,
  description: `TanStack DB gives you a reactive, client-first store for your API data with collections, live queries and optimistic mutations that keep your UI reactive, consistent and blazing fast 🔥`,
  ogImage: 'https://github.com/tanstack/db/raw/main/media/repo-header.png',
  badge: 'beta',
  bgStyle: `bg-orange-700`,
  borderStyle: 'border-orange-700/50',
  textStyle: `text-orange-500`,
  repo,
  latestBranch: 'main',
  latestVersion: 'v0',
  availableVersions: ['v0'],
  bgRadial: 'from-orange-500 via-orange-700/50 to-transparent',
  colorFrom: `from-orange-500`,
  colorTo: `to-orange-700`,
  textColor: `text-orange-700`,
  frameworks: ['react', 'vue', 'solid', 'svelte', 'vanilla'],
  scarfId: '302d0fef-cb3f-43c6-b45c-f055b9745edb',
  defaultDocs: 'overview',
  featureHighlights: [
    {
      title: 'Collections',
      icon: <GalleryVerticalEnd className={twMerge(textStyles)} />,
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
      icon: <Zap className={twMerge(textStyles)} />,
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
      icon: <CogsIcon className={twMerge(textStyles)} />,
      description: (
        <div>
          Batch and stage instant local changes across collections. Sync
          transactions to the backend with automatic management of rollbacks and
          optimistic state.
        </div>
      ),
    },
  ],
}
