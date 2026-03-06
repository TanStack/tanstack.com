import { Library } from '.'
import { BookOpen, Package, RefreshCw } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { intent } from './libraries'

const textStyles = `text-sky-600 dark:text-sky-500`

export const intentProject = {
  ...intent,
  featureHighlights: [
    {
      title: 'Skills as npm Packages',
      icon: <Package className={twMerge(textStyles)} />,
      description: (
        <div>
          Skills are knowledge encoded for AI coding agents, shipped as npm
          packages. They travel with your tool via{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            npm update
          </span>{' '}
          — not the model's training cutoff, not community-maintained rules
          files, not prompt snippets in READMEs.
        </div>
      ),
    },
    {
      title: 'Automatic Discovery',
      icon: <BookOpen className={twMerge(textStyles)} />,
      description: (
        <div>
          Run{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            intent install
          </span>{' '}
          and the CLI discovers every intent-enabled package in your
          dependencies, wiring skills into your agent configuration — CLAUDE.md,
          .cursorrules, whatever your tooling expects.
        </div>
      ),
    },
    {
      title: 'Staleness Detection',
      icon: <RefreshCw className={twMerge(textStyles)} />,
      description: (
        <div>
          Each skill declares its source docs. When those docs change,{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            intent stale
          </span>{' '}
          flags the skill for review. Run it in CI and you get a failing check
          when sources drift — skills become part of your release checklist.
        </div>
      ),
    },
  ],
} satisfies Library
