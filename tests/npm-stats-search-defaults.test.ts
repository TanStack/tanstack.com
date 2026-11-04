import assert from 'node:assert/strict'
import test from 'node:test'
import * as v from 'valibot'
import { stripSearchParams } from '@tanstack/react-router'
import {
  npmStatsSearchSchema,
  defaultNpmStatsSearch,
} from '../src/routes/stats/npm/index'

test('default chart state produces a clean shareable URL', () => {
  const result = v.parse(npmStatsSearchSchema, {})
  const serialized = stripSearchParams(defaultNpmStatsSearch)({
    search: result,
    next: () => result,
  })
  assert.deepEqual(serialized, {})
})

test('non-default packages and display controls survive default stripping', () => {
  for (const packages of [
    ['react'],
    ['@tanstack/react-query'],
    ['react', 'vue'],
  ]) {
    const packageGroups = packages.map((name) => ({ packages: [{ name }] }))
    const result = v.parse(npmStatsSearchSchema, {
      packageGroups,
      height: 600,
      showLegend: true,
    })
    const serialized = stripSearchParams(defaultNpmStatsSearch)({
      search: result,
      next: () => result,
    })
    assert.deepEqual(serialized, {
      packageGroups,
      height: 600,
      showLegend: true,
    })
  }
})
