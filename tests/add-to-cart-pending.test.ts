import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const productPage = readFileSync(
  new URL('../src/routes/shop.products.$handle.tsx', import.meta.url),
  'utf8',
)
const productDrawer = readFileSync(
  new URL('../src/components/shop/ProductDrawer.tsx', import.meta.url),
  'utf8',
)
const cartDrawer = readFileSync(
  new URL('../src/components/shop/CartDrawer.tsx', import.meta.url),
  'utf8',
)
const useCart = readFileSync(
  new URL('../src/hooks/useCart.ts', import.meta.url),
  'utf8',
)

test('add controls stay disabled for the full addToCart.isPending interval', () => {
  for (const source of [productPage, productDrawer]) {
    assert.equal(source.includes('isPending && !showAdded'), false)
    assert.match(source, /addToCart\.isPending/)
  }
})

test('cart drawer pending state tracks add-to-cart mutations only', () => {
  assert.match(useCart, /CART_ADD_MUTATION_KEY = \['shopify', 'cart', 'add'\]/)
  assert.match(useCart, /mutationKey: CART_ADD_MUTATION_KEY/)
  assert.match(
    cartDrawer,
    /useIsMutating\(\{ mutationKey: CART_ADD_MUTATION_KEY \}\)/,
  )
  assert.equal(cartDrawer.includes('CART_MUTATION_KEY'), false)
})
