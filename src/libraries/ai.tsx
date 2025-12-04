import { VscPreview } from 'react-icons/vsc'
import { Library } from '.'
import { FaGithub, FaBolt, FaCogs } from 'react-icons/fa'
import { BiBookAlt } from 'react-icons/bi'
import { twMerge } from 'tailwind-merge'
import { FaPlug } from 'react-icons/fa6'

const repo = 'tanstack/ai'

const textStyles = `text-pink-600 dark:text-pink-500`

export const aiProject = {
  id: 'ai',
  name: 'TanStack AI',
  cardStyles: `shadow-xl shadow-pink-700/20 dark:shadow-lg dark:shadow-pink-500/20 text-pink-500 dark:text-pink-400 border-2 border-transparent hover:border-current`,
  to: '/ai',
  tagline: `A powerful, open-source AI SDK with a unified interface across multiple providers`,
  description: `A powerful, open-source AI SDK with a unified interface across multiple providers. No vendor lock-in, no proprietary formats, just clean TypeScript and honest open source.`,
  ogImage: 'https://github.com/tanstack/ai/raw/main/media/repo-header.png',
  badge: 'alpha',
  bgStyle: `bg-pink-700`,
  textStyle: `text-pink-500`,
  repo,
  latestBranch: 'main',
  latestVersion: 'v0',
  availableVersions: ['v0'],
  bgRadial: 'from-pink-500 via-pink-700/50 to-transparent',
  colorFrom: `from-pink-500`,
  colorTo: `to-pink-700`,
  textColor: `text-pink-700`,
  frameworks: ['react', 'solid', 'vanilla'],
  scarfId: undefined,
  defaultDocs: 'getting-started/overview',
  menu: [
    {
      icon: <BiBookAlt />,
      label: 'Docs',
      to: '/ai/latest/docs',
    },
    {
      icon: <FaGithub />,
      label: 'Github',
      to: `https://github.com/${repo}`,
    },
  ],
  featureHighlights: [
    {
      title: 'Multi-Provider Support',
      icon: <FaPlug className={twMerge(textStyles)} />,
      description: (
        <div>
          Support for OpenAI, Anthropic, Ollama, and Google Gemini. Switch
          providers at runtime without code changes. No vendor lock-in, just
          clean TypeScript.
        </div>
      ),
    },
    {
      title: 'Unified API',
      icon: <FaBolt className={twMerge(textStyles)} />,
      description: (
        <div>
          Same interface across all providers. Standalone functions with
          automatic type inference from adapters. Framework-agnostic client for
          any JavaScript environment.
        </div>
      ),
    },
    {
      title: 'Tool/Function Calling',
      icon: <FaCogs className={twMerge(textStyles)} />,
      description: (
        <div>
          Automatic execution loop with no manual tool management needed.
          Type-safe tool definitions with structured outputs and streaming
          support.
        </div>
      ),
    },
  ],
} satisfies Library
