import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyOptimisticAddToCart } from '../src/utils/cart-optimistic'
import type { CartDetail } from '../src/utils/shopify-queries'

const line = {
  productTitle: 'Classic Hoodie',
  productHandle: 'classic-hoodie',
  variantTitle: 'Black / L',
  price: { amount: '48.00', currencyCode: 'USD' },
  image: {
    url: 'https://cdn.shopify.com/hoodie.jpg',
    altText: 'Classic Hoodie',
    width: 800,
    height: 800,
  },
  selectedOptions: [
    { name: 'Color', value: 'Black' },
    { name: 'Size', value: 'L' },
  ],
}

test('first add seeds a cart line when no cart exists', () => {
  const next = applyOptimisticAddToCart(null, {
    variantId: 'gid://shopify/ProductVariant/1',
    quantity: 1,
    line,
  })

  assert.ok(next)
  assert.equal(next.totalQuantity, 1)
  assert.equal(next.lines.nodes.length, 1)
  assert.equal(next.lines.nodes[0]?.merchandise.product.title, 'Classic Hoodie')
  assert.equal(
    next.lines.nodes[0]?.merchandise.id,
    'gid://shopify/ProductVariant/1',
  )
  assert.equal(next.checkoutUrl, '')
  assert.equal(next.lines.nodes[0]?.cost.totalAmount.amount, '48.00')
  assert.equal(next.cost.totalAmount.amount, '48.00')
  assert.equal(next.cost.subtotalAmount.amount, '48.00')
  assert.equal(next.cost.totalTaxAmount, null)
})

test('adding the same variant increments quantity', () => {
  const first = applyOptimisticAddToCart(null, {
    variantId: 'gid://shopify/ProductVariant/1',
    quantity: 1,
    line,
  })
  const next = applyOptimisticAddToCart(first, {
    variantId: 'gid://shopify/ProductVariant/1',
    quantity: 2,
    line,
  })

  assert.ok(next)
  assert.equal(next.lines.nodes.length, 1)
  assert.equal(next.lines.nodes[0]?.quantity, 3)
  assert.equal(next.totalQuantity, 3)
  assert.equal(next.checkoutUrl, '')
  assert.equal(next.lines.nodes[0]?.cost.totalAmount.amount, '144.00')
  assert.equal(next.cost.totalAmount.amount, '144.00')
  assert.equal(next.cost.subtotalAmount.amount, '144.00')
})

test('adding a different variant prepends a new line', () => {
  const existing: CartDetail = {
    id: 'gid://shopify/Cart/1',
    checkoutUrl: 'https://checkout.example/cart',
    totalQuantity: 1,
    cost: {
      totalAmount: { amount: '28.00', currencyCode: 'USD' },
      subtotalAmount: { amount: '28.00', currencyCode: 'USD' },
      totalTaxAmount: null,
    },
    lines: {
      nodes: [
        {
          id: 'gid://shopify/CartLine/tee',
          quantity: 1,
          merchandise: {
            id: 'gid://shopify/ProductVariant/tee',
            title: 'White / M',
            availableForSale: true,
            selectedOptions: [
              { name: 'Color', value: 'White' },
              { name: 'Size', value: 'M' },
            ],
            price: { amount: '28.00', currencyCode: 'USD' },
            image: null,
            product: { handle: 'classic-tee', title: 'Classic Tee' },
          },
          cost: {
            totalAmount: { amount: '28.00', currencyCode: 'USD' },
          },
        },
      ],
    },
    discountCodes: [],
  }

  const next = applyOptimisticAddToCart(existing, {
    variantId: 'gid://shopify/ProductVariant/1',
    quantity: 1,
    line,
  })

  assert.ok(next)
  assert.equal(next.lines.nodes.length, 2)
  assert.equal(next.lines.nodes[0]?.merchandise.product.title, 'Classic Hoodie')
  assert.equal(next.totalQuantity, 2)
  assert.equal(next.checkoutUrl, '')
  assert.equal(next.cost.totalAmount.amount, '76.00')
  assert.equal(next.cost.subtotalAmount.amount, '76.00')
})

test('line and cart totals stay decimal-safe', () => {
  const cheap = {
    ...line,
    price: { amount: '19.99', currencyCode: 'USD' },
  }
  const next = applyOptimisticAddToCart(null, {
    variantId: 'gid://shopify/ProductVariant/cheap',
    quantity: 2,
    line: cheap,
  })

  assert.ok(next)
  assert.equal(next.lines.nodes[0]?.cost.totalAmount.amount, '39.98')
  assert.equal(next.cost.totalAmount.amount, '39.98')
  assert.equal(next.cost.subtotalAmount.amount, '39.98')
})

test('without a line snapshot, an empty cache stays empty', () => {
  const next = applyOptimisticAddToCart(null, {
    variantId: 'gid://shopify/ProductVariant/1',
    quantity: 1,
  })
  assert.equal(next, null)
})

test('without a line snapshot, checkoutUrl is cleared on an existing cart', () => {
  const existing: CartDetail = {
    id: 'gid://shopify/Cart/1',
    checkoutUrl: 'https://checkout.example/cart',
    totalQuantity: 1,
    cost: {
      totalAmount: { amount: '28.00', currencyCode: 'USD' },
      subtotalAmount: { amount: '28.00', currencyCode: 'USD' },
      totalTaxAmount: null,
    },
    lines: {
      nodes: [
        {
          id: 'gid://shopify/CartLine/tee',
          quantity: 1,
          merchandise: {
            id: 'gid://shopify/ProductVariant/tee',
            title: 'White / M',
            availableForSale: true,
            selectedOptions: [
              { name: 'Color', value: 'White' },
              { name: 'Size', value: 'M' },
            ],
            price: { amount: '28.00', currencyCode: 'USD' },
            image: null,
            product: { handle: 'classic-tee', title: 'Classic Tee' },
          },
          cost: {
            totalAmount: { amount: '28.00', currencyCode: 'USD' },
          },
        },
      ],
    },
    discountCodes: [],
  }

  const next = applyOptimisticAddToCart(existing, {
    variantId: 'gid://shopify/ProductVariant/1',
    quantity: 1,
  })

  assert.ok(next)
  assert.equal(next.checkoutUrl, '')
  assert.equal(next.totalQuantity, 2)
})
