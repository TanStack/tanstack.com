import {
  ArrowCounterClockwise,
  GitBranch,
  MagnifyingGlass,
  ShieldCheck,
} from '@phosphor-icons/react'

import {
  LibraryLanding,
  type LibraryLandingConfig,
} from '~/components/landing/LibraryLanding'

const workflowLandingConfig = {
  libraryId: 'workflow',
  headline: 'Put long-running business work in a model you can trust.',
  description:
    'Workflow models approvals, retries, fan-out, slow external systems, and visible run state as TypeScript workflows instead of one-off background jobs scattered across the app.',
  distinction: 'Durable business processes in TypeScript',
  hero: {
    label: 'workflow run',
    actionLabel: 'Retry',
    detailTitle: 'Run state stays explicit',
    detailBody:
      'Every step keeps its input, output, attempts, waiting reason, and next action visible through interruptions.',
    items: [
      {
        key: 'validate-order',
        title: 'Typed payload accepted',
        badge: 'done',
        activity: 100,
      },
      {
        key: 'reserve-inventory',
        title: 'Backoff 30 seconds',
        badge: 'retry',
        activity: 63,
      },
      {
        key: 'manager-approval',
        title: 'Waiting at human gate',
        badge: 'wait',
        activity: 42,
      },
    ],
    facts: [
      { label: 'run id', value: 'order-4832' },
      { label: 'current step', value: 'reserve inventory' },
      { label: 'attempt', value: '2 of 5' },
      { label: 'next action', value: 'wait for approval' },
    ],
  },
  features: [
    {
      icon: GitBranch,
      label: 'Typed graph',
      title: 'Business processes become typed graphs.',
      body: 'Inputs, outputs, shared context, branching, and step boundaries stay modeled in TypeScript instead of being implied by background job glue.',
    },
    {
      icon: ShieldCheck,
      label: 'Run state',
      title: 'State is part of the model.',
      body: 'Long-running work needs visible run state around slow systems, retries, human delays, and the next action the process is waiting on.',
    },
    {
      icon: ArrowCounterClockwise,
      label: 'Recovery',
      title: 'Retries live next to the work.',
      body: 'Backoff, recovery, compensation, and error handling stay close to the step that can fail, where maintainers can reason about it.',
    },
    {
      icon: MagnifyingGlass,
      label: 'Inspection',
      title: 'Workflow state is meant to be inspected.',
      body: 'A process that matters needs visible history, status, inputs, outputs, and next actions, not a hidden promise chain.',
    },
  ],
  lifecycle: {
    label: 'Execution model',
    title: 'Start, step, wait, resume.',
    body: 'Typed workflows let process state move through time deliberately instead of hoping a single request or queue worker keeps everything together.',
    steps: [
      {
        label: 'Start',
        body: 'A typed workflow run begins with a known input and initial context.',
      },
      {
        label: 'Step',
        body: 'Each step owns its input, output, retry policy, and side effects.',
      },
      {
        label: 'Wait',
        body: 'The run can pause around external systems, timers, or approvals.',
      },
      {
        label: 'Resume',
        body: 'Execution continues with history and state intact after interruptions.',
      },
    ],
  },
  flow: {
    label: 'Observable process state',
    title: 'If the business cares, the runtime should show it.',
    body: 'Runs expose IDs, inputs, history, attempts, waiting reasons, and next actions so operators and developers can tell what happened and what comes next.',
    steps: [
      { label: 'Validate order', code: 'done' },
      { label: 'Reserve inventory', code: 'retrying · 30s' },
      { label: 'Manager approval', code: 'waiting' },
      { label: 'Fulfillment', code: 'queued · 3 regions' },
    ],
  },
  prompt: [
    'Build a TanStack Workflow process for a TypeScript app.',
    'Model a multi-step workflow with typed inputs and outputs, retries, backoff, approvals, fan-out, and inspectable execution history.',
    'Keep business process state explicit, and verify concrete API calls against the current Workflow docs before implementation.',
  ].join(' '),
  promptLabel: 'Copy Workflow prompt',
} satisfies LibraryLandingConfig

export default function WorkflowLanding() {
  return <LibraryLanding config={workflowLandingConfig} />
}
