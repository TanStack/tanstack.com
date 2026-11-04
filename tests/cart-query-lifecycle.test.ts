import { test } from 'node:test'
import { build } from 'esbuild'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

test('cart hook accepts an expired cart response and reconciles failed first adds', async () => {
  const root = resolve(import.meta.dirname, '..')
  const directory = await mkdtemp(join(tmpdir(), 'cart-lifecycle-'))
  try {
    const result = await build({
      stdin: {
        resolveDir: root,
        contents: `
          import assert from 'node:assert/strict'
          import { createElement } from 'react'
          import { renderToString } from 'react-dom/server'
          import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
          import { useCart, useAddToCart, CART_QUERY_KEY } from './src/hooks/useCart'
          import { applyOptimisticAddToCart } from './src/utils/cart-optimistic'
          import { holdAdd, completeAdd, addStarted } from '~/utils/shop.functions'
          export async function verify() {
            const client = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}})
            let hooks
            function Harness() {
              hooks = {cart: useCart(), add: useAddToCart()}
              return null
            }
            const input = {variantId: 'variant-1', quantity: 1, line: {
              productTitle: 'Shirt', productHandle: 'shirt', variantTitle: 'Blue',
              price: {amount: '10.00', currencyCode: 'USD'}, image: null,
              selectedOptions: [{name: 'Color', value: 'Blue'}]
            }}
            const cached = {...applyOptimisticAddToCart(null, input), checkoutUrl: 'https://checkout.example/expired'}
            client.setQueryData(CART_QUERY_KEY, cached)
            renderToString(createElement(QueryClientProvider, {client}, createElement(Harness)))
            try {
              await hooks.cart.refetch()
              assert.equal(client.getQueryData(CART_QUERY_KEY), null, 'authoritative null must clear stale lines and checkout')
              await assert.rejects(hooks.add.mutateAsync(input), /Shopify unavailable/)
              assert.equal(client.getQueryData(CART_QUERY_KEY), null, 'failed first add must restore empty cart')
              client.removeQueries({queryKey: CART_QUERY_KEY})
              renderToString(createElement(QueryClientProvider, {client}, createElement(Harness)))
              await assert.rejects(hooks.add.mutateAsync(input), /Shopify unavailable/)
              assert.equal(client.getQueryData(CART_QUERY_KEY), null, 'failed unseeded add must not retain synthetic lines')
              holdAdd()
              const pending = hooks.add.mutateAsync(input)
              await addStarted
              const optimistic = client.getQueryData(CART_QUERY_KEY)
              assert.equal(optimistic.lines.nodes.length, 1)
              assert.equal(optimistic.checkoutUrl, '')
              const confirmed = {...optimistic, id: 'server-cart', checkoutUrl: 'https://checkout.example/confirmed'}
              completeAdd(confirmed)
              await pending
              assert.equal(client.getQueryData(CART_QUERY_KEY).checkoutUrl, confirmed.checkoutUrl)
              await hooks.cart.refetch()
              assert.equal(client.getQueryData(CART_QUERY_KEY), null, 'later expiry clears a successfully added cart')
            } finally { client.clear() }
          }
        `,
      },
      bundle: true,
      platform: 'node',
      format: 'esm',
      banner: {
        js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
      },
      write: false,
      alias: { '~': join(root, 'src') },
      plugins: [
        {
          name: 'shop-server-boundary',
          setup(builder) {
            builder.onResolve({ filter: /shop\.functions$/ }, () => ({
              path: 'shop-functions',
              namespace: 'fixture',
            }))
            builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
              contents: `
          export async function getCart() { return null }
          const gate = Promise.withResolvers()
          const started = Promise.withResolvers()
          export const addStarted = started.promise
          let hold = false
          export function holdAdd() { hold = true }
          export function completeAdd(cart) { gate.resolve(cart) }
          export async function addToCart() {
            if (!hold) throw new Error('Shopify unavailable')
            started.resolve()
            return gate.promise
          }
          export const applyDiscountCode = addToCart
          export const removeCartLine = addToCart
          export const removeDiscountCode = addToCart
          export const updateCartLine = addToCart
        `,
            }))
          },
        },
      ],
    })
    const file = join(directory, 'fixture.mjs')
    await writeFile(file, result.outputFiles[0].text)
    const fixture = await import(pathToFileURL(file).href)
    await fixture.verify()
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
