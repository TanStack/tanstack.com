import { expect, it } from 'vitest'
import {
  pendingPackageGuide,
  type PendingTask,
} from '../../src/chat/core/tasks'
import type { AssistantTask } from '../../src/chat/core/assistant-task'

const task: PendingTask = {
  id: 'step',
  kind: 'external-step',
  turnId: 'turn',
  request: 'List my channels',
  title: 'Connect account',
  instructions: 'Finish setup.',
  url: 'https://example.com/connect?provider=notes',
  evidenceRef: 'package:notes#README.md',
}
const observations: AssistantTask['observations'] = [
  {
    approvalId: 'approval',
    title: 'List channels',
    outcome: 'failed',
    result: 'Integration missing',
    packageDocumentation: {
      entity: 'package:149fd608-2ec1-4da1-9d93-f85816d74ccc#README.md',
      content:
        'Fork first, then use https://example.com/connect?provider=notes.',
      excerpted: false,
    },
  },
]

it('shows the exact package guide even when Kody and the model use different package aliases', () => {
  expect(pendingPackageGuide(task, observations)).toEqual(
    observations[0]?.packageDocumentation,
  )
  expect(
    pendingPackageGuide(
      { ...task, url: 'https://example.com/different' },
      observations,
    ),
  ).toBeUndefined()
})
