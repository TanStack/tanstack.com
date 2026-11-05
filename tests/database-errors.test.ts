import assert from 'node:assert/strict'
import { test } from 'node:test'
import { databaseFailureKind } from '../src/db/errors'

test('classifies wrapped connection failures without exposing driver details', () => {
  const cause = Object.assign(new Error('private database hostname'), {
    code: 'CONNECT_TIMEOUT',
  })
  assert.equal(
    databaseFailureKind(new Error('SQL with private parameters', { cause })),
    'connection_timeout',
  )
  assert.equal(
    databaseFailureKind(
      new Error('Connection terminated due to connection timeout'),
    ),
    'connection_timeout',
  )
  assert.equal(databaseFailureKind({ code: '53300' }), 'too_many_connections')
  assert.equal(
    databaseFailureKind(new Error('Network connection lost.')),
    'connection_lost',
  )
})

test('never returns arbitrary codes or messages and bounds cyclic causes', () => {
  const error = { code: 'private value', message: 'private value', cause: {} }
  error.cause = error
  assert.equal(databaseFailureKind(error), 'unknown')
  assert.equal(databaseFailureKind('private value'), 'unknown')
  assert.equal(databaseFailureKind(null), 'unknown')
})
