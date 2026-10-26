/// <reference types="node" />
import assert from 'node:assert/strict'
import test from 'node:test'
import { isNotFound, isRedirect } from '@tanstack/react-router'
import * as v from 'valibot'
import {
  comparisonSearchSchema,
  redirectNpmComparison,
} from '../src/routes/stats/npm/$packages'

async function runBeforeLoad(packages: string) {
  return redirectNpmComparison({
    params: { packages },
    search: v.parse(comparisonSearchSchema, { height: 600 }),
  })
}

test('comparison links redirect before rendering and preserve selected packages', async () => {
  for (const [path, names] of [
    ['react', ['react']],
    ['react-vs-vue', ['react', 'vue']],
    ['@tanstack~1react-query', ['@tanstack/react-query']],
    ['@tanstack__react-query', ['@tanstack/react-query']],
  ] satisfies [string, string[]][]) {
    await assert.rejects(runBeforeLoad(path), (error: unknown) => {
      assert.ok(isRedirect(error))
      assert.equal(error.options.to, '/stats/npm')
      assert.deepEqual(error.options.search, {
        ...v.parse(comparisonSearchSchema, { height: 600 }),
        packageGroups: names.map((name) => ({ packages: [{ name }] })),
      })
      return true
    })
  }
})

test('invalid or oversized comparisons return not found', async () => {
  for (const path of [
    'react-vs-',
    '-vs-',
    'react-vs-INVALID',
    Array(33).fill('react').join('-vs-'),
  ]) {
    await assert.rejects(runBeforeLoad(path), isNotFound)
  }
})
