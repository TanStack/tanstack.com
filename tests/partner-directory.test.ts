import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultStringifySearch } from '@tanstack/react-router'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as v from 'valibot'
import { PartnerStatusFilter } from '../src/components/PartnerStatusFilter'
import {
  getPartnerDirectoryMetadata,
  getPartnerDirectorySearch,
  normalizePartnerDirectorySearch,
  partnerDirectorySearchSchema,
} from '../src/utils/partner-directory'

test('current partners use the bare directory canonical', () => {
  const search = v.parse(partnerDirectorySearchSchema, { status: 'active' })

  assert.equal(defaultStringifySearch(search), '')
  assert.deepEqual(normalizePartnerDirectorySearch(search), {
    status: 'active',
  })
  assert.deepEqual(getPartnerDirectorySearch('active'), {
    status: undefined,
  })
})

test('invalid partner status falls back to the bare current directory', () => {
  const search = v.parse(partnerDirectorySearchSchema, { status: 'bogus' })

  assert.equal(defaultStringifySearch(search), '')
  assert.deepEqual(normalizePartnerDirectorySearch(search), {
    status: 'active',
  })
})

test('previous partners keep a distinct canonical and metadata', () => {
  const search = v.parse(partnerDirectorySearchSchema, {
    status: 'inactive',
  })
  const metadata = getPartnerDirectoryMetadata('inactive')

  assert.equal(defaultStringifySearch(search), '?status=inactive')
  assert.deepEqual(normalizePartnerDirectorySearch(search), {
    status: 'inactive',
  })
  assert.match(metadata.title, /Previous/)
  assert.match(metadata.description, /previously supported/)
})

test('status filter uses a keyboard-native radio group', () => {
  const html = renderToStaticMarkup(
    createElement(PartnerStatusFilter, {
      selectedStatus: 'active',
      onStatusChange: () => {},
    }),
  )

  assert.equal((html.match(/type="radio"/g) ?? []).length, 2)
  assert.equal((html.match(/name="partner-status"/g) ?? []).length, 2)
  assert.equal((html.match(/checked=""/g) ?? []).length, 1)
  assert.match(html, /<fieldset/)
  assert.match(html, /<legend/)
  assert.match(html, /peer-focus-visible:outline/)
})
