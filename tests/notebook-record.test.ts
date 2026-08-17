import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseDeleteNotebookRecordResponse,
  parseNotebookRecord,
  parseNotebookRecordListResponse,
  parseNotebookRecordResponse,
} from '../src/utils/notebook-record'

const record = {
  version: 1,
  id: '11111111-1111-4111-8111-111111111111',
  ownerId: '22222222-2222-4222-8222-222222222222',
  projectHash: 'a'.repeat(64),
  forkedFromId: '33333333-3333-4333-8333-333333333333',
  title: 'Notebook record',
  description: 'A public notebook.',
  author: { name: 'Notebook author', image: null },
  createdAt: '2026-08-15T12:00:00.000Z',
  updatedAt: '2026-08-15T13:00:00.000Z',
}

test('parses notebook records and API response envelopes', () => {
  assert.deepEqual(parseNotebookRecord(record), record)
  assert.deepEqual(parseNotebookRecordResponse({ record }), record)
  assert.deepEqual(parseNotebookRecordListResponse({ records: [record] }), [
    record,
  ])
  assert.equal(
    parseDeleteNotebookRecordResponse({ deleted: true, id: record.id }),
    record.id,
  )
})

test('strictly rejects malformed notebook records and responses', () => {
  assert.throws(() => parseNotebookRecord({ ...record, unknown: true }))
  assert.throws(() => parseNotebookRecord({ ...record, id: 'not-a-uuid' }))
  assert.throws(() =>
    parseNotebookRecord({ ...record, projectHash: 'not-a-hash' }),
  )
  assert.throws(() =>
    parseNotebookRecord({ ...record, forkedFromId: 'not-a-uuid' }),
  )
  assert.throws(() => parseNotebookRecordResponse(record))
  assert.throws(() => parseNotebookRecordListResponse({ records: [null] }))
  assert.throws(() =>
    parseDeleteNotebookRecordResponse({ deleted: false, id: record.id }),
  )
})
