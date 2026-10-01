import assert from 'node:assert/strict'
import { test } from 'node:test'
import { selectIntentPartners } from '../src/utils/application-starter-intent'

const partners = [
  { id: 'workos', category: 'auth', uniqueConstraints: ['auth-provider'] },
  { id: 'clerk', category: 'auth', uniqueConstraints: ['auth-provider'] },
  { id: 'cloudflare', category: 'deployment', uniqueConstraints: ['hosting'] },
  { id: 'railway', category: 'deployment', uniqueConstraints: ['hosting'] },
  { id: 'prisma', category: 'database', uniqueConstraints: [] },
]
const intent = {
  eligiblePartnerIds: partners.map((partner) => partner.id),
  preferredPartnerIds: [],
  excludedPartnerIds: [],
}

test('e-commerce capabilities select only the first eligible provider per category', () => {
  assert.deepEqual(selectIntentPartners({ intent, partners, selections: {} }), [
    'workos',
    'cloudflare',
    'prisma',
  ])
})

test('eligibility preserves placement order instead of adding a provider ranking', () => {
  assert.deepEqual(
    selectIntentPartners({
      intent,
      partners: [...partners].reverse(),
      selections: {},
    }),
    ['prisma', 'railway', 'clerk'],
  )
})

test('named providers win over the rotated order', () => {
  assert.deepEqual(
    selectIntentPartners({
      intent: { ...intent, preferredPartnerIds: ['clerk', 'railway'] },
      partners,
      selections: {},
    }),
    ['clerk', 'railway', 'prisma'],
  )
})

test('manual selections win over named providers and inferred providers', () => {
  assert.deepEqual(
    selectIntentPartners({
      intent: { ...intent, preferredPartnerIds: ['clerk'] },
      partners,
      selections: { workos: true },
    }),
    ['cloudflare', 'prisma'],
  )
})

test('manual and prompt exclusions are not reselected', () => {
  assert.deepEqual(
    selectIntentPartners({
      intent: { ...intent, excludedPartnerIds: ['clerk', 'railway'] },
      partners,
      selections: { workos: false, cloudflare: false },
    }),
    ['prisma'],
  )
})

test('ambiguous prompts and failures preserve the existing behavior', () => {
  assert.deepEqual(
    selectIntentPartners({
      intent: null,
      partners,
      selections: { clerk: true },
    }),
    [],
  )
})

test('unsupported and inactive providers cannot be selected', () => {
  assert.deepEqual(
    selectIntentPartners({
      intent: {
        ...intent,
        eligiblePartnerIds: ['unknown', 'neon'],
        preferredPartnerIds: ['convex'],
      },
      partners,
      selections: {},
    }),
    [],
  )
})
