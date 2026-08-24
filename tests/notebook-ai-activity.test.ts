import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NotebookAgentActivity } from '../src/components/notebook/NotebookAgentActivity'
import {
  getNotebookAiActivitySummary,
  getNotebookAiActivityItemLabel,
  parseNotebookAiActivity,
  reduceNotebookAiActivity,
  type NotebookAiActivity,
  type NotebookAiActivityEvent,
} from '../src/utils/notebook-ai-activity'

function reduceEvents(events: ReadonlyArray<NotebookAiActivityEvent>) {
  let activity: NotebookAiActivity | undefined
  for (const event of events) {
    activity = reduceNotebookAiActivity(activity, event)
  }
  if (!activity) throw new Error('Expected notebook activity')
  return activity
}

test('notebook activity excludes raw file contents from persisted data', () => {
  const activity = reduceEvents([
    { type: 'run-started', runId: 'run-1', timestamp: 1_000 },
    {
      type: 'item-running',
      runId: 'run-1',
      itemId: 'read-1',
      source: 'tool',
      name: 'read_file',
      timestamp: 1_100,
      input: { path: '/index.tsx', offset: 0 },
    },
    {
      type: 'item-completed',
      runId: 'run-1',
      itemId: 'read-1',
      source: 'tool',
      name: 'read_file',
      timestamp: 1_200,
      output: {
        path: '/index.tsx',
        content: 'READ_SOURCE_MUST_NOT_PERSIST',
        offset: 0,
        totalCharacters: 28,
        nextOffset: null,
      },
    },
    {
      type: 'item-running',
      runId: 'run-1',
      itemId: 'edit-1',
      source: 'tool',
      name: 'replace_file',
      timestamp: 1_300,
      input: {
        path: '/index.tsx',
        content: 'REPLACEMENT_SOURCE_MUST_NOT_PERSIST',
      },
    },
    {
      type: 'item-completed',
      runId: 'run-1',
      itemId: 'edit-1',
      source: 'tool',
      name: 'replace_file',
      timestamp: 1_400,
      output: {
        path: '/index.tsx',
        characters: 35,
        diff: '-old\n+new',
      },
    },
    { type: 'run-completed', runId: 'run-1', timestamp: 2_000 },
  ])

  const persisted = JSON.stringify(activity)
  assert.doesNotMatch(persisted, /READ_SOURCE_MUST_NOT_PERSIST/)
  assert.doesNotMatch(persisted, /REPLACEMENT_SOURCE_MUST_NOT_PERSIST/)
  assert.match(persisted, /index\.tsx/)
  assert.match(persisted, /-old\\n\+new/)
  assert.equal(activity.items[0]?.details.characters, 28)
  assert.equal(activity.items[1]?.details.characters, 35)
})

test('notebook activity summarizes a successful automatic repair', () => {
  const activity = reduceEvents([
    { type: 'run-started', runId: 'run-2', timestamp: 1_000 },
    {
      type: 'item-completed',
      runId: 'run-2',
      itemId: 'edit-1',
      source: 'tool',
      name: 'replace_file',
      timestamp: 1_200,
      output: { path: '/index.tsx', characters: 100 },
    },
    {
      type: 'item-failed',
      runId: 'run-2',
      itemId: 'preview-1',
      source: 'harness',
      name: 'run_notebook',
      timestamp: 1_500,
      error: 'ReferenceError: value is not defined',
      output: { phase: 'runtime' },
    },
    {
      type: 'item-running',
      runId: 'run-2',
      itemId: 'repair-1',
      source: 'harness',
      name: 'repair_notebook',
      timestamp: 1_600,
      input: { phase: 'runtime', attempt: 1, maxAttempts: 2 },
    },
    {
      type: 'item-completed',
      runId: 'run-2',
      itemId: 'repair-1',
      source: 'harness',
      name: 'repair_notebook',
      timestamp: 1_800,
    },
    {
      type: 'item-completed',
      runId: 'run-2',
      itemId: 'edit-2',
      source: 'tool',
      name: 'replace_file',
      timestamp: 2_000,
      output: { path: '/chart.tsx', characters: 200 },
    },
    {
      type: 'item-completed',
      runId: 'run-2',
      itemId: 'preview-2',
      source: 'harness',
      name: 'run_notebook',
      timestamp: 2_500,
      output: { phase: 'runtime' },
    },
    { type: 'run-completed', runId: 'run-2', timestamp: 3_000 },
  ])

  assert.equal(
    getNotebookAiActivitySummary(activity),
    'Edited 2 files, fixed a runtime error, and ran the notebook',
  )
})

test('notebook activity strictly parses sanitized persisted traces', () => {
  const activity = reduceEvents([
    { type: 'run-started', runId: 'run-persisted', timestamp: 1_000 },
    {
      type: 'item-completed',
      runId: 'run-persisted',
      itemId: 'read-1',
      source: 'tool',
      name: 'read_file',
      timestamp: 1_500,
      output: {
        path: '/index.tsx',
        content: 'not persisted',
        totalCharacters: 13,
      },
    },
    { type: 'run-completed', runId: 'run-persisted', timestamp: 2_000 },
  ])
  const persisted: unknown = JSON.parse(JSON.stringify(activity))

  assert.deepEqual(parseNotebookAiActivity(persisted), activity)
  assert.throws(
    () =>
      parseNotebookAiActivity({
        ...activity,
        items: [
          {
            ...activity.items[0],
            details: {
              ...activity.items[0]?.details,
              content: 'raw source',
            },
          },
        ],
      }),
    /Invalid notebook AI activity/,
  )
})

test('notebook activity keeps only capped reasoning summaries', () => {
  const summary = 'Consider the component structure. '.repeat(300)
  const activity = reduceEvents([
    { type: 'run-started', runId: 'run-reasoning', timestamp: 1_000 },
    {
      type: 'item-running',
      runId: 'run-reasoning',
      itemId: 'reasoning-1',
      source: 'reasoning',
      name: 'reasoning',
      timestamp: 1_100,
      input: { message: summary },
    },
    {
      type: 'item-completed',
      runId: 'run-reasoning',
      itemId: 'reasoning-1',
      source: 'reasoning',
      name: 'reasoning',
      timestamp: 1_500,
      output: { message: summary },
    },
    { type: 'run-completed', runId: 'run-reasoning', timestamp: 2_000 },
  ])

  assert.equal(
    getNotebookAiActivitySummary(activity),
    'Thought through approach',
  )
  assert.equal(activity.items[0]?.details.message?.length, 4_000)
  assert.match(activity.items[0]?.details.message ?? '', /\n…$/)
  assert.deepEqual(
    parseNotebookAiActivity(JSON.parse(JSON.stringify(activity))),
    activity,
  )
})

test('notebook activity stops unfinished items with the run', () => {
  const activity = reduceEvents([
    { type: 'run-started', runId: 'run-3', timestamp: 1_000 },
    {
      type: 'item-running',
      runId: 'run-3',
      itemId: 'install-1',
      source: 'tool',
      name: 'install_dependency',
      timestamp: 1_100,
      input: { name: '@tanstack/charts', version: '0.13.0' },
    },
    { type: 'run-stopped', runId: 'run-3', timestamp: 1_500 },
  ])

  assert.equal(activity.status, 'stopped')
  assert.equal(activity.items[0]?.status, 'stopped')
  assert.equal(activity.items[0]?.details.packageName, '@tanstack/charts')
  assert.equal(getNotebookAiActivitySummary(activity), 'Stopped')
})

test('notebook activity labels checkpoint rollback outcomes', () => {
  const completed = reduceEvents([
    { type: 'run-started', runId: 'run-rollback', timestamp: 1_000 },
    {
      type: 'item-completed',
      runId: 'run-rollback',
      itemId: 'rollback',
      source: 'harness',
      name: 'rollback_workspace',
      timestamp: 1_500,
    },
    {
      type: 'run-failed',
      runId: 'run-rollback',
      timestamp: 2_000,
      error: 'Original run failed',
    },
  ])
  assert.equal(
    getNotebookAiActivityItemLabel(completed.items[0]!),
    'Restored notebook checkpoint',
  )
})

test('notebook activity summarizes package evidence without persisting source', () => {
  const activity = reduceEvents([
    { type: 'run-started', runId: 'run-package', timestamp: 1_000 },
    {
      type: 'item-completed',
      runId: 'run-package',
      itemId: 'inspect-1',
      source: 'tool',
      name: 'inspect_module',
      timestamp: 1_500,
      output: {
        packageName: '@tanstack/charts',
        packageVersion: '0.13.0',
        source: 'PACKAGE_SOURCE_MUST_NOT_PERSIST',
        declarations: 'PACKAGE_TYPES_MUST_NOT_PERSIST',
      },
    },
    { type: 'run-completed', runId: 'run-package', timestamp: 2_000 },
  ])

  assert.equal(getNotebookAiActivitySummary(activity), 'Inspected package API')
  assert.equal(activity.items[0]?.details.packageName, '@tanstack/charts')
  assert.equal(activity.items[0]?.details.packageVersion, '0.13.0')
  assert.doesNotMatch(JSON.stringify(activity), /PACKAGE_(?:SOURCE|TYPES)/)
})

test('notebook activity settles unfinished items when a run completes', () => {
  const activity = reduceEvents([
    { type: 'run-started', runId: 'run-complete', timestamp: 1_000 },
    {
      type: 'item-running',
      runId: 'run-complete',
      itemId: 'preview-1',
      source: 'harness',
      name: 'run_notebook',
      timestamp: 1_100,
    },
    { type: 'run-completed', runId: 'run-complete', timestamp: 1_500 },
  ])

  assert.equal(activity.status, 'complete')
  assert.equal(activity.items[0]?.status, 'stopped')
  assert.equal(activity.items[0]?.completedAt, 1_500)
  assert.deepEqual(
    parseNotebookAiActivity(JSON.parse(JSON.stringify(activity))),
    activity,
  )
})

test('notebook agent activity summaries are collapsed by default', () => {
  const activities = [
    reduceEvents([{ type: 'run-started', runId: 'running', timestamp: 1_000 }]),
    reduceEvents([
      { type: 'run-started', runId: 'complete', timestamp: 1_000 },
      { type: 'run-completed', runId: 'complete', timestamp: 2_000 },
    ]),
    reduceEvents([
      { type: 'run-started', runId: 'error', timestamp: 1_000 },
      {
        type: 'run-failed',
        runId: 'error',
        timestamp: 2_000,
        error: 'Failed',
      },
    ]),
    reduceEvents([
      { type: 'run-started', runId: 'stopped', timestamp: 1_000 },
      { type: 'run-stopped', runId: 'stopped', timestamp: 2_000 },
    ]),
  ]

  for (const activity of activities) {
    const markup = renderToStaticMarkup(
      React.createElement(NotebookAgentActivity, { activity }),
    )

    assert.match(markup, /aria-expanded="false"/)
    assert.match(markup, /aria-hidden="true"/)
  }
})

test('notebook agent activity supports explicitly expanded details', () => {
  const activity = reduceEvents([
    { type: 'run-started', runId: 'run-4', timestamp: 1_000 },
    {
      type: 'item-completed',
      runId: 'run-4',
      itemId: 'edit-1',
      source: 'tool',
      name: 'replace_file',
      timestamp: 1_500,
      output: {
        path: '/index.tsx',
        characters: 120,
        diff: '-old\n+new',
      },
    },
    { type: 'run-completed', runId: 'run-4', timestamp: 2_000 },
  ])
  const markup = renderToStaticMarkup(
    React.createElement(NotebookAgentActivity, {
      activity,
      defaultOpen: true,
    }),
  )

  assert.match(markup, /aria-label="Agent activity"/)
  assert.match(markup, /aria-expanded="true"/)
  assert.match(markup, /aria-controls=/)
  assert.match(markup, /role="region"/)
  assert.match(markup, /Edited 1 file/)
  assert.match(markup, /Diff for \/index\.tsx/)
})

test('notebook agent activity keeps raw errors neutral and readable', () => {
  const activity = reduceEvents([
    { type: 'run-started', runId: 'run-error', timestamp: 1_000 },
    {
      type: 'run-failed',
      runId: 'run-error',
      timestamp: 2_000,
      error: "SyntaxError: Missing export 'band'\n    at /index.tsx:4:10",
    },
  ])
  const markup = renderToStaticMarkup(
    React.createElement(NotebookAgentActivity, {
      activity,
      defaultOpen: true,
    }),
  )

  assert.match(markup, /aria-label="Agent error"/)
  assert.match(markup, /text-text-secondary/)
  assert.doesNotMatch(markup, /border-l-border-error/)
  assert.doesNotMatch(markup, /font-medium text-text-error/)
})
