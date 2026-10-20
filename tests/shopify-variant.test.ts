import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasAvailableVariant } from '../src/utils/shopify-queries'

const variants = [
  {
    availableForSale: false,
    selectedOptions: [
      { name: 'Color', value: 'Black' },
      { name: 'Size', value: 'Small' },
    ],
  },
  {
    availableForSale: true,
    selectedOptions: [
      { name: 'Color', value: 'Black' },
      { name: 'Size', value: 'Large' },
    ],
  },
  {
    availableForSale: false,
    selectedOptions: [
      { name: 'Color', value: 'Blue' },
      { name: 'Size', value: 'Large' },
    ],
  },
]

test('partial selections stay available when any matching variant is in stock', () => {
  assert.equal(hasAvailableVariant(variants, { Color: 'Black' }), true)
})

test('complete selections only match the selected variant', () => {
  assert.equal(
    hasAvailableVariant(variants, { Color: 'Black', Size: 'Small' }),
    false,
  )
  assert.equal(
    hasAvailableVariant(variants, { Color: 'Black', Size: 'Large' }),
    true,
  )
})

test('partial selections are unavailable when all matches are sold out', () => {
  assert.equal(hasAvailableVariant(variants, { Color: 'Blue' }), false)
})
