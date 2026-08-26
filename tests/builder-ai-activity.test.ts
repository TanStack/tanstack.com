import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BuilderAgentActivity } from '../src/components/builder/BuilderAgentActivity'
import {
  builderAiActivityDurableMaxBytes,
  compactBuilderAiActivityForDurableSync,
  getBuilderAiActivitySummary,
  getBuilderAiActivityItemLabel,
  parseBuilderAiActivity,
  reduceBuilderAiActivity,
  type BuilderAiActivity,
  type BuilderAiActivityEvent,
} from '../src/utils/builder-ai-activity'

function reduceEvents(events: ReadonlyArray<BuilderAiActivityEvent>) {
  let activity: BuilderAiActivity | undefined
  for (const event of events) {
    activity = reduceBuilderAiActivity(activity, event)
  }
  if (!activity) throw new Error('Expected builder activity')
  return activity
}

test('builder activity excludes raw file contents from persisted data', () => {
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

test('builder activity summarizes a successful automatic repair', () => {
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
      name: 'run_project',
      timestamp: 1_500,
      error: 'ReferenceError: value is not defined',
      output: { phase: 'runtime' },
    },
    {
      type: 'item-running',
      runId: 'run-2',
      itemId: 'repair-1',
      source: 'harness',
      name: 'repair_project',
      timestamp: 1_600,
      input: { phase: 'runtime', attempt: 1, maxAttempts: 2 },
    },
    {
      type: 'item-completed',
      runId: 'run-2',
      itemId: 'repair-1',
      source: 'harness',
      name: 'repair_project',
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
      name: 'run_project',
      timestamp: 2_500,
      output: { phase: 'runtime' },
    },
    { type: 'run-completed', runId: 'run-2', timestamp: 3_000 },
  ])

  assert.equal(
    getBuilderAiActivitySummary(activity),
    'Edited 2 files, fixed a runtime error, and ran the builder',
  )
})

test('builder activity strictly parses sanitized persisted traces', () => {
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

  assert.deepEqual(parseBuilderAiActivity(persisted), activity)
  assert.throws(
    () =>
      parseBuilderAiActivity({
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
    /Invalid builder AI activity/,
  )
})

test('durable activity compaction removes verbose detail without changing local activity', () => {
  const events: Array<BuilderAiActivityEvent> = [
    { type: 'run-started', runId: 'run-large-diffs', timestamp: 1_000 },
  ]
  for (let index = 0; index < 4; index++) {
    events.push({
      type: 'item-completed',
      runId: 'run-large-diffs',
      itemId: `edit-${index}`,
      source: 'tool',
      name: 'replace_file',
      timestamp: 1_100 + index,
      output: {
        path: `/file-${index}.tsx`,
        diff: `-${'x'.repeat(25_000)}\n+${'y'.repeat(25_000)}`,
      },
    })
  }
  events.push({
    type: 'run-completed',
    runId: 'run-large-diffs',
    timestamp: 2_000,
  })
  const activity = reduceEvents(events)
  const summary = getBuilderAiActivitySummary(activity)

  assert.ok(serializedBytes(activity) > builderAiActivityDurableMaxBytes)
  const compacted = compactBuilderAiActivityForDurableSync(activity)

  assert.ok(serializedBytes(compacted) <= builderAiActivityDurableMaxBytes)
  assert.equal(getBuilderAiActivitySummary(compacted), summary)
  assert.equal(compacted.items.length, activity.items.length)
  assert.equal(compacted.items[0]?.details.diff, undefined)
  assert.ok(activity.items[0]?.details.diff)
  assert.deepEqual(
    parseBuilderAiActivity(JSON.parse(JSON.stringify(compacted))),
    compacted,
  )
})

test('durable activity compaction deterministically retains recent actions and an honest summary', () => {
  const events: Array<BuilderAiActivityEvent> = [
    { type: 'run-started', runId: 'run-large-paths', timestamp: 1_000 },
  ]
  for (let index = 0; index < 10; index++) {
    events.push({
      type: 'item-completed',
      runId: 'run-large-paths',
      itemId: `apply-${index}`,
      source: 'harness',
      name: 'apply_workspace',
      timestamp: 1_100 + index,
      output: {
        paths: Array.from(
          { length: 100 },
          (_, pathIndex) =>
            `/generated/${index}/${pathIndex}-${'路'.repeat(600)}.tsx`,
        ),
      },
    })
  }
  events.push(
    {
      type: 'item-completed',
      runId: 'run-large-paths',
      itemId: 'preview',
      source: 'harness',
      name: 'run_project',
      timestamp: 1_500,
    },
    {
      type: 'run-completed',
      runId: 'run-large-paths',
      timestamp: 2_000,
    },
  )
  const activity = reduceEvents(events)
  const summary = getBuilderAiActivitySummary(activity)
  const compacted = compactBuilderAiActivityForDurableSync(activity)

  assert.ok(serializedBytes(compacted) <= builderAiActivityDurableMaxBytes)
  assert.equal(compacted.items.at(-1)?.name, 'activity_summary')
  assert.ok(
    compacted.items.filter((item) => item.name !== 'activity_summary').length <
      activity.items.length,
  )
  assert.equal(compacted.items.at(-1)?.details.message, summary)
  assert.equal(getBuilderAiActivitySummary(compacted), summary)
  assert.deepEqual(compactBuilderAiActivityForDurableSync(activity), compacted)
  assert.equal(activity.items[0]?.details.paths?.length, 100)
})

test('builder activity keeps only capped reasoning summaries', () => {
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
    getBuilderAiActivitySummary(activity),
    'Thought through approach',
  )
  assert.equal(activity.items[0]?.details.message?.length, 4_000)
  assert.match(activity.items[0]?.details.message ?? '', /\n…$/)
  assert.deepEqual(
    parseBuilderAiActivity(JSON.parse(JSON.stringify(activity))),
    activity,
  )
})

test('builder activity stops unfinished items with the run', () => {
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
  assert.equal(getBuilderAiActivitySummary(activity), 'Stopped')
})

test('builder activity labels checkpoint rollback outcomes', () => {
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
    getBuilderAiActivityItemLabel(completed.items[0]!),
    'Restored builder checkpoint',
  )
})

test('builder activity summarizes package evidence without persisting source', () => {
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

  assert.equal(getBuilderAiActivitySummary(activity), 'Inspected package API')
  assert.equal(activity.items[0]?.details.packageName, '@tanstack/charts')
  assert.equal(activity.items[0]?.details.packageVersion, '0.13.0')
  assert.doesNotMatch(JSON.stringify(activity), /PACKAGE_(?:SOURCE|TYPES)/)
})

test('builder activity settles unfinished items when a run completes', () => {
  const activity = reduceEvents([
    { type: 'run-started', runId: 'run-complete', timestamp: 1_000 },
    {
      type: 'item-running',
      runId: 'run-complete',
      itemId: 'preview-1',
      source: 'harness',
      name: 'run_project',
      timestamp: 1_100,
    },
    { type: 'run-completed', runId: 'run-complete', timestamp: 1_500 },
  ])

  assert.equal(activity.status, 'complete')
  assert.equal(activity.items[0]?.status, 'stopped')
  assert.equal(activity.items[0]?.completedAt, 1_500)
  assert.deepEqual(
    parseBuilderAiActivity(JSON.parse(JSON.stringify(activity))),
    activity,
  )
})

test('builder agent activity summaries are collapsed by default', () => {
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
      React.createElement(BuilderAgentActivity, { activity }),
    )

    assert.match(markup, /aria-expanded="false"/)
    assert.match(markup, /aria-hidden="true"/)
  }
})

test('builder agent activity supports explicitly expanded details', () => {
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
    React.createElement(BuilderAgentActivity, {
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

test('builder agent activity keeps raw errors neutral and readable', () => {
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
    React.createElement(BuilderAgentActivity, {
      activity,
      defaultOpen: true,
    }),
  )

  assert.match(markup, /aria-label="Agent error"/)
  assert.match(markup, /text-text-secondary/)
  assert.doesNotMatch(markup, /border-l-border-error/)
  assert.doesNotMatch(markup, /font-medium text-text-error/)
})

function serializedBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength
}
