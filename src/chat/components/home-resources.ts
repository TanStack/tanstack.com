import {
  BellIcon,
  BookOpenIcon,
  BrainIcon,
  CalendarDotsIcon,
  ChatCircleIcon,
  CubeFocusIcon,
  EnvelopeSimpleIcon,
  FlowArrowIcon,
  GaugeIcon,
  HardDrivesIcon,
  PlugIcon,
  PulseIcon,
  type Icon,
} from '@phosphor-icons/react'
import type { HomeSection } from '../core/home-navigation'

export const homeResources: Record<
  HomeSection,
  { label: string; icon: Icon; description: string }
> = {
  shared: {
    label: 'Shared packages',
    icon: CubeFocusIcon,
    description: 'Packages shared with you and by you.',
  },
  account: {
    label: 'Kody account',
    icon: HardDrivesIcon,
    description: 'Profile, security, connected agents, and billing.',
  },
  subscriptions: {
    label: 'Subscriptions',
    icon: BellIcon,
    description: 'Package event handlers.',
  },
  webhooks: {
    label: 'Webhooks',
    icon: FlowArrowIcon,
    description: 'Incoming events from other services.',
  },
  secrets: {
    label: 'Secrets',
    icon: HardDrivesIcon,
    description: 'Credential names, scopes, and allowed hosts.',
  },
  'secret-providers': {
    label: 'Secret providers',
    icon: PlugIcon,
    description: 'External credential providers.',
  },
  conversations: {
    label: 'Conversations',
    icon: ChatCircleIcon,
    description: 'Pick up where you left off.',
  },
  attention: {
    label: 'Needs attention',
    icon: BellIcon,
    description: 'Approvals, errors, and unfinished setup.',
  },
  packages: {
    label: 'Packages',
    icon: CubeFocusIcon,
    description: 'Saved software, its tools, and the work it runs.',
  },
  skills: {
    label: 'Skills',
    icon: BookOpenIcon,
    description: 'Instructions your assistant can use.',
  },
  routines: {
    label: 'Scheduled jobs',
    icon: CalendarDotsIcon,
    description: 'Scheduled work and its next run.',
  },
  workflows: {
    label: 'Workflow runs',
    icon: FlowArrowIcon,
    description: 'Recorded multi-step executions.',
  },
  activity: {
    label: 'Activity',
    icon: PulseIcon,
    description: 'Execution history, results, and errors.',
  },
  integrations: {
    label: 'Integrations',
    icon: PlugIcon,
    description: 'Accounts and services available to Kody.',
  },
  servers: {
    label: 'MCP servers',
    icon: HardDrivesIcon,
    description: 'Connected servers and their tools.',
  },
  memories: {
    label: 'Memories',
    icon: BrainIcon,
    description: 'Facts and preferences shared across your agents.',
  },
  mail: {
    label: 'Mail',
    icon: EnvelopeSimpleIcon,
    description:
      'Incoming email can start work; notifications tell you what finished.',
  },
  usage: {
    label: 'Kody usage',
    icon: GaugeIcon,
    description: 'Kody plan and resource limits.',
  },
  community: {
    label: 'Plugins',
    icon: PlugIcon,
    description: 'Find plugins from connected sources.',
  },
}
// Product hierarchy, independent of inventory counts or account usage.
export const homeGroups: { label: string; sections: HomeSection[] }[] = [
  { label: 'Your work', sections: ['attention', 'skills'] },
  {
    label: 'Kody',
    sections: [
      'packages',
      'memories',
      'activity',
      'routines',
      'workflows',
      'subscriptions',
      'webhooks',
      'mail',
      'integrations',
      'servers',
      'secrets',
      'secret-providers',
      'community',
      'shared',
      'usage',
      'account',
    ],
  },
]
export const homeEmptyMessages: Partial<Record<HomeSection, string>> = {
  packages:
    'No saved packages yet. Packages keep useful software available to every agent.',
  routines:
    'No scheduled jobs yet. Jobs run package code on a recurring schedule, even while you are away.',
  workflows:
    'No workflow runs found. Workflows handle deferred or longer-running work.',
  integrations:
    'No integrations found. Connect accounts so packages can work with your services.',
  servers:
    'No MCP servers found. Servers extend the tools your agents can reach.',
  skills:
    'No skills found. Skills carry reusable instructions for your agents.',
}
