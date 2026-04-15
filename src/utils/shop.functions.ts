import { createServerFn } from '@tanstack/react-start'
import {
  deleteCookie,
  getCookie,
  setCookie,
  setResponseHeaders,
} from '@tanstack/react-start/server'
import * as v from 'valibot'
import { shopifyServerFetch } from '~/server/shopify/fetch'
import {
  CART_CREATE_MUTATION,
  CART_LINES_ADD_MUTATION,
  CART_LINES_REMOVE_MUTATION,
  CART_LINES_UPDATE_MUTATION,
  CART_QUERY,
  COLLECTIONS_QUERY,
  PRODUCTS_QUERY,
  PRODUCT_QUERY,
  SHOP_QUERY,
  type CartCreateResult,
  type CartDetail,
  type CartLinesAddResult,
  type CartLinesRemoveResult,
  type CartLinesUpdateResult,
  type CartQueryResult,
  type CartUserError,
  type CollectionListItem,
  type CollectionsQueryResult,
  type ProductDetail,
  type ProductListItem,
  type ProductQueryResult,
  type ProductsQueryResult,
  type ShopQueryResult,
} from '~/utils/shopify-queries'

const CART_COOKIE_NAME = 'tanstack_cart_id'
const CART_COOKIE_OPTIONS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365, // 1 year
  sameSite: 'lax' as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
}

class CartUserErrorsError extends Error {
  constructor(public readonly userErrors: Array<CartUserError>) {
    super(userErrors.map((e) => e.message).join('\n'))
    this.name = 'CartUserErrorsError'
  }
}

function throwIfUserErrors(errs: Array<CartUserError>) {
  if (errs.length > 0) throw new CartUserErrorsError(errs)
}

/**
 * Edge-cache product browse responses for a few minutes. Catalog data
 * doesn't change often and webhook-based revalidation can refine this later.
 */
function setBrowseCacheHeaders() {
  setResponseHeaders(
    new Headers({
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control':
        'public, max-age=300, durable, stale-while-revalidate=600',
    }),
  )
}

export const getShop = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ShopQueryResult['shop']> => {
    setBrowseCacheHeaders()
    const data = await shopifyServerFetch<ShopQueryResult>({
      query: SHOP_QUERY,
    })
    return data.shop
  },
)

export const getProducts = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<ProductListItem>> => {
    setBrowseCacheHeaders()
    const result = await shopifyServerFetch<
      ProductsQueryResult,
      { first: number }
    >({
      query: PRODUCTS_QUERY,
      variables: { first: 50 },
    })
    return result.products.nodes
  },
)

export const getCollections = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<CollectionListItem>> => {
    setBrowseCacheHeaders()
    const result = await shopifyServerFetch<
      CollectionsQueryResult,
      { first: number }
    >({
      query: COLLECTIONS_QUERY,
      variables: { first: 50 },
    })
    return result.collections.nodes
  },
)

export const getProduct = createServerFn({ method: 'POST' })
  .inputValidator(v.object({ handle: v.string() }))
  .handler(async ({ data }): Promise<ProductDetail | null> => {
    setBrowseCacheHeaders()
    const result = await shopifyServerFetch<
      ProductQueryResult,
      { handle: string }
    >({
      query: PRODUCT_QUERY,
      variables: { handle: data.handle },
    })
    return result.product
  })

/* ──────────────────────────────────────────────────────────────────────────
 * Cart server functions
 *
 * Cart ID is stored in an httpOnly cookie. Reads + writes all go through the
 * server (higher rate limits via the private token, no token on the client,
 * and SSR can load the cart in route loaders). Optimistic updates happen in
 * the React Query cache on top of these.
 * ────────────────────────────────────────────────────────────────────────── */

function setCartResponseHeaders() {
  // Cart is per-user; do not edge-cache.
  setResponseHeaders(
    new Headers({ 'Cache-Control': 'private, no-store, must-revalidate' }),
  )
}

async function fetchCartById(cartId: string): Promise<CartDetail | null> {
  const result = await shopifyServerFetch<CartQueryResult, { cartId: string }>({
    query: CART_QUERY,
    variables: { cartId },
  })
  return result.cart
}

export const getCart = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CartDetail | null> => {
    setCartResponseHeaders()
    const cartId = getCookie(CART_COOKIE_NAME)
    if (!cartId) return null

    const cart = await fetchCartById(cartId)
    // If Shopify pruned the cart (expired/abandoned), clear the stale cookie.
    if (!cart) deleteCookie(CART_COOKIE_NAME, { path: '/' })
    return cart
  },
)

export const addToCart = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      variantId: v.string(),
      quantity: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
    }),
  )
  .handler(async ({ data }): Promise<CartDetail> => {
    setCartResponseHeaders()
    const existingCartId = getCookie(CART_COOKIE_NAME)

    if (!existingCartId) {
      const result = await shopifyServerFetch<CartCreateResult>({
        query: CART_CREATE_MUTATION,
        variables: {
          input: {
            lines: [
              {
                merchandiseId: data.variantId,
                quantity: data.quantity,
              },
            ],
          },
        },
      })
      throwIfUserErrors(result.cartCreate.userErrors)
      const cart = result.cartCreate.cart
      if (!cart) throw new Error('Shopify returned no cart after create.')
      setCookie(CART_COOKIE_NAME, cart.id, CART_COOKIE_OPTIONS)
      return cart
    }

    const result = await shopifyServerFetch<CartLinesAddResult>({
      query: CART_LINES_ADD_MUTATION,
      variables: {
        cartId: existingCartId,
        lines: [{ merchandiseId: data.variantId, quantity: data.quantity }],
      },
    })
    throwIfUserErrors(result.cartLinesAdd.userErrors)
    const cart = result.cartLinesAdd.cart
    // If the existing cart was pruned between requests, fall through and
    // create a fresh cart with this line.
    if (!cart) {
      deleteCookie(CART_COOKIE_NAME, { path: '/' })
      const createResult = await shopifyServerFetch<CartCreateResult>({
        query: CART_CREATE_MUTATION,
        variables: {
          input: {
            lines: [{ merchandiseId: data.variantId, quantity: data.quantity }],
          },
        },
      })
      throwIfUserErrors(createResult.cartCreate.userErrors)
      const newCart = createResult.cartCreate.cart
      if (!newCart)
        throw new Error('Shopify returned no cart after recovery create.')
      setCookie(CART_COOKIE_NAME, newCart.id, CART_COOKIE_OPTIONS)
      return newCart
    }
    return cart
  })

export const updateCartLine = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      lineId: v.string(),
      quantity: v.pipe(v.number(), v.integer(), v.minValue(0)),
    }),
  )
  .handler(async ({ data }): Promise<CartDetail> => {
    setCartResponseHeaders()
    const cartId = getCookie(CART_COOKIE_NAME)
    if (!cartId) throw new Error('No cart exists to update.')

    const result = await shopifyServerFetch<CartLinesUpdateResult>({
      query: CART_LINES_UPDATE_MUTATION,
      variables: {
        cartId,
        lines: [{ id: data.lineId, quantity: data.quantity }],
      },
    })
    throwIfUserErrors(result.cartLinesUpdate.userErrors)
    const cart = result.cartLinesUpdate.cart
    if (!cart) throw new Error('Shopify returned no cart after update.')
    return cart
  })

export const removeCartLine = createServerFn({ method: 'POST' })
  .inputValidator(v.object({ lineId: v.string() }))
  .handler(async ({ data }): Promise<CartDetail> => {
    setCartResponseHeaders()
    const cartId = getCookie(CART_COOKIE_NAME)
    if (!cartId) throw new Error('No cart exists to remove from.')

    const result = await shopifyServerFetch<CartLinesRemoveResult>({
      query: CART_LINES_REMOVE_MUTATION,
      variables: { cartId, lineIds: [data.lineId] },
    })
    throwIfUserErrors(result.cartLinesRemove.userErrors)
    const cart = result.cartLinesRemove.cart
    if (!cart) throw new Error('Shopify returned no cart after remove.')
    return cart
  })
