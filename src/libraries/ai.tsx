import { Library } from '.'
import { PlugIcon, LightningIcon, GearIcon } from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import { ai } from './libraries'

const textStyles = `text-category-data`

export const aiProject = {
  ...ai,
  description: `TanStack AI gives you composable building blocks for everything you should not write yourself: the agent loop, provider adapters, durability, interrupts, sandboxes, and tools. It leaves you everything a one-size-fits-all framework gets wrong past the prototype: your server, your database, your UI. Typed end to end, AG-UI native, and no TanStack service in the request path.`,
  latestBranch: 'main',
  defaultDocs: 'getting-started/overview',
  featureHighlights: [
    {
      title: "We Build What You Shouldn't",
      icon: <GearIcon className={twMerge(textStyles)} />,
      description: (
        <div>
          <code>chat()</code> drives the agent loop: typed tools that run on the
          server or the client, stop strategies, interrupts that pause a run for
          a human and resume at the exact step, and a durability log that
          survives a dropped socket or a reload without re-running the model.
        </div>
      ),
    },
    {
      title: 'You Own What Outgrows a Framework',
      icon: <PlugIcon className={twMerge(textStyles)} />,
      description: (
        <div>
          Your route, your database, your UI. Persistence is two store functions
          against your own schema. The server is one call and a Response in any
          framework. Your requests, credentials, and data never pass through
          TanStack.
        </div>
      ),
    },
    {
      title: 'One Mental Model, Typed End to End',
      icon: <LightningIcon className={twMerge(textStyles)} />,
      description: (
        <div>
          Every major provider behind one call, each model typed down to its
          options and modalities. A framework-free core with React, Vue, Solid,
          Svelte, Preact, Angular, React Native, and Octane bindings, all
          speaking native AG-UI over the transport you choose.
        </div>
      ),
    },
  ],
} satisfies Library
