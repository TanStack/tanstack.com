import * as React from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { CaretDownIcon } from '@phosphor-icons/react/CaretDown'
import { CheckCircleIcon } from '@phosphor-icons/react/CheckCircle'
import { CopyIcon } from '@phosphor-icons/react/Copy'
import { SparkleIcon } from '@phosphor-icons/react/Sparkle'
import { useCopyButton } from '~/components/CopyMarkdownButton'
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
} from '~/components/Dropdown'
import { getLibrary } from '~/libraries'
import { copyTextToClipboard } from '~/utils/browser-effects'

type SkillAgent = {
  command: string
  description: string
  id: string
  name: string
  pinned?: boolean
}

const projectSkillsPrompt =
  'Copy the tanstack-ai and tanstack-ai-migration skill folders, including their supporting files, from https://github.com/TanStack/ai/tree/main/skills into .agents/skills/ in this project. Read the installed skills.'

const skillAgents: Array<SkillAgent> = [
  {
    id: 'claude',
    name: 'Claude Code',
    description: 'Paste these into Claude Code.',
    command: '/plugin marketplace add TanStack/ai\n/plugin install tanstack-ai',
    pinned: true,
  },
  {
    id: 'grok',
    name: 'Grok Build',
    description: 'Paste this into Grok Build. Or open /plugins → Marketplace.',
    command: '/plugins install TanStack/ai',
    pinned: true,
  },
  {
    id: 'codex',
    name: 'Codex',
    description: 'Paste this into Codex. Or open /plugins to browse.',
    command: '$skill-installer TanStack/ai',
    pinned: true,
  },
  {
    id: 'cursor',
    name: 'Cursor',
    description: 'Paste these into Cursor Agent chat.',
    command: '/plugin marketplace add TanStack/ai\n/plugin install tanstack-ai',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description: 'Paste this into OpenCode to install project skills.',
    command: projectSkillsPrompt,
  },
  {
    id: 'amp',
    name: 'Amp',
    description: 'Run this in your project terminal for Amp.',
    command: 'amp skill add https://github.com/TanStack/ai',
  },
  {
    id: 't3-code',
    name: 'T3 Code',
    description:
      'Paste this into T3 Code. Your selected agent installs the skills.',
    command:
      'Copy the tanstack-ai and tanstack-ai-migration skill folders, including their supporting files, from https://github.com/TanStack/ai/tree/main/skills into your native project skills directory. Read the installed skills.',
  },
  {
    id: 'kimi',
    name: 'Kimi Code',
    description: 'Paste this into Kimi Code to install project skills.',
    command: projectSkillsPrompt,
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    description: 'Paste this into Antigravity to install project skills.',
    command: projectSkillsPrompt,
  },
  {
    id: 'npx',
    name: 'Skills (npx)',
    description:
      'Run this in your project terminal, then select your coding agent.',
    command:
      'npx skills add TanStack/ai --skill tanstack-ai tanstack-ai-migration',
  },
]

const pinnedAgents = skillAgents.filter((agent) => agent.pinned)
const moreAgents = skillAgents.filter((agent) => !agent.pinned)

const tabClass =
  'shrink-0 whitespace-nowrap border-b-2 pb-2 text-ds-label-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-accent-bright)'

export function LandingPromptBox() {
  const [activeId, setActiveId] = React.useState('claude')
  const agent =
    skillAgents.find((item) => item.id === activeId) ??
    pinnedAgents.find((item) => item.id === 'claude')
  const moreSelected = agent
    ? moreAgents.some((item) => item.id === agent.id)
    : false
  const [copied, onCopy] = useCopyButton(() =>
    copyTextToClipboard(agent?.command ?? ''),
  )
  const { version } = useParams({ strict: false })
  const library = getLibrary('ai')

  if (!agent) {
    return null
  }

  return (
    <div className="mt-6 w-full max-w-136">
      <p className="flex items-center gap-2 text-ds-body-sm text-text-primary">
        <SparkleIcon aria-hidden="true" size={16} weight="fill" />
        Using an AI coding agent? Install the TanStack AI skills:
      </p>
      <div
        className="mt-4 flex gap-5 overflow-x-auto border-b border-border-subtle"
        role="tablist"
        aria-label="Coding agent"
      >
        {pinnedAgents.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === agent.id}
            className={`${tabClass} ${
              item.id === agent.id
                ? 'border-(--landing-accent) text-(--landing-accent-bright)'
                : 'border-transparent text-text-primary/45 hover:text-text-primary'
            }`}
            onClick={() => setActiveId(item.id)}
          >
            {item.name}
          </button>
        ))}
        <Dropdown>
          <DropdownTrigger>
            <button
              type="button"
              role="tab"
              aria-selected={moreSelected}
              className={`inline-flex items-center gap-1 ${tabClass} ${
                moreSelected
                  ? 'border-(--landing-accent) text-(--landing-accent-bright)'
                  : 'border-transparent text-text-primary/45 hover:text-text-primary'
              }`}
            >
              More
              <CaretDownIcon aria-hidden="true" size={12} />
            </button>
          </DropdownTrigger>
          <DropdownContent align="start" className="min-w-40">
            {moreAgents.map((item) => (
              <DropdownItem key={item.id} onSelect={() => setActiveId(item.id)}>
                {item.name}
              </DropdownItem>
            ))}
          </DropdownContent>
        </Dropdown>
      </div>
      <p className="mt-4 text-ds-body-sm text-text-secondary">
        {agent.description}
      </p>
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-text-primary/4 px-3 py-2.5">
        <pre className="min-w-0 flex-1 whitespace-pre-wrap wrap-anywhere font-ds-mono text-ds-mono-xs text-text-primary/80">
          {agent.command}
        </pre>
        <button
          type="button"
          aria-label={copied ? 'Copied' : 'Copy install instructions'}
          onClick={onCopy}
          className="shrink-0 text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-accent-bright)"
        >
          {copied ? (
            <CheckCircleIcon size={16} aria-hidden="true" />
          ) : (
            <CopyIcon size={16} aria-hidden="true" />
          )}
        </button>
      </div>
      <Link
        to="/$libraryId/$version/docs/$"
        params={{
          libraryId: library.id,
          version: version ?? library.latestVersion,
          _splat: 'getting-started/agent-skills',
        }}
        className="mt-3 inline-block text-ds-label-sm text-(--landing-accent-bright) hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-accent-bright)"
      >
        Learn more about agent skills
      </Link>
    </div>
  )
}
