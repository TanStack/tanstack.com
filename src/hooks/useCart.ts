import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCartDrawerStore } from '~/components/shop/cartDrawerStore'
import {
  applyOptimisticAddToCart,
  cartHasLines,
  type AddToCartLineSnapshot,
} from '~/utils/cart-optimistic'
import {
  addToCart,
  applyDiscountCode,
  getCart,
  removeCartLine,
  removeDiscountCode,
  updateCartLine,
} from '~/utils/shop.functions'
import type { CartDetail } from '~/utils/shopify-queries'

/**
 * Shared React Query key for the current user's cart.
 *
 * The cart ID lives in an httpOnly cookie on the server, so the client never
 * needs to know it — a single cache key is enough. Route loaders prefetch
 * into this key so the first render already has the data.
 */
export const CART_QUERY_KEY = ['shopify', 'cart'] as const

/**
 * Mutation key shared across cart-mutating hooks other than add-to-cart.
 * Used by `settleWhenIdle` to determine whether other cart mutations are still
 * in flight before triggering a background refetch.
 */
export const CART_MUTATION_KEY = ['shopify', 'cart', 'mutate'] as const

/**
 * Distinct from `CART_MUTATION_KEY` (and not a prefix of it) so
 * `useIsMutating` in the cart drawer matches add-to-cart only.
 */
export const CART_ADD_MUTATION_KEY = ['shopify', 'cart', 'add'] as const

/**
 * Explicit in-flight counter. We don't rely on `queryClient.isMutating()`
 * because its exact semantics at `onSettled` time (does it still count the
 * current mutation?) vary across React Query versions and are under-documented.
 * A module-level counter is unambiguous: increment in onMutate, decrement in
 * onSettled, invalidate when the count hits zero.
 */
let cartMutationsInFlight = 0

function trackMutationStart() {
  cartMutationsInFlight++
}

/**
 * Call from every cart mutation's `onSettled`. Decrements the in-flight
 * counter, and when the last mutation settles, triggers a single background
 * refetch to reconcile all accumulated optimistic changes with server truth.
 *
 * Returns the invalidation promise so the mutation stays in `isPending`
 * until the refetch completes.
 *
 * @see https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query
 */
function settleWhenIdle(qc: ReturnType<typeof useQueryClient>) {
  cartMutationsInFlight = Math.max(0, cartMutationsInFlight - 1)
  if (cartMutationsInFlight === 0) {
    return qc.invalidateQueries({ queryKey: CART_QUERY_KEY })
  }
}

function openDrawerIfCartHasLines(cart: CartDetail | null | undefined) {
  if (cartHasLines(cart)) useCartDrawerStore.getState().openDrawer()
}

/**
 * Read the current cart. Data is loader-seeded on shop routes, so there is
 * no hydration gap — components that call this render with real data on the
 * first frame. On non-shop routes the hook falls back to fetching on mount.
 *
 * After cartCreate the httpOnly cookie may not have landed on the immediate
 * refetch. If Shopify says there is no cart but we already have lines in
 * cache (optimistic or the mutation result), keep those lines.
 */
export function useCart() {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: CART_QUERY_KEY,
    queryFn: async () => {
      const cart = await getCart()
      if (cart) return cart
      const cached = qc.getQueryData<CartDetail | null>(CART_QUERY_KEY)
      if (cartHasLines(cached)) return cached ?? null
      return null
    },
    staleTime: 30_000,
  })

  return {
    cart: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    totalQuantity: query.data?.totalQuantity ?? 0,
  }
}

type AddToCartInput = {
  variantId: string
  quantity?: number
  /** Product snapshot for optimistic line rendering. */
  line?: AddToCartLineSnapshot
}

export function useAddToCart() {
  const qc = useQueryClient()

  return useMutation({
    mutationKey: CART_ADD_MUTATION_KEY,
    mutationFn: (input: AddToCartInput) =>
      addToCart({
        data: { variantId: input.variantId, quantity: input.quantity ?? 1 },
      }),

    onMutate: async (input) => {
      trackMutationStart()
      await qc.cancelQueries({ queryKey: CART_QUERY_KEY })
      const previous = qc.getQueryData<CartDetail | null>(CART_QUERY_KEY)
      const next = applyOptimisticAddToCart(previous, {
        variantId: input.variantId,
        quantity: input.quantity ?? 1,
        line: input.line,
      })
      qc.setQueryData(CART_QUERY_KEY, next)
      openDrawerIfCartHasLines(next)
      return { previous }
    },

    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined)
        qc.setQueryData(CART_QUERY_KEY, ctx.previous)
    },

    // Reconcile: replace the optimistic line (temporary ID, approximate
    // totals) with the real server response.
    onSuccess: (cart) => {
      qc.setQueryData(CART_QUERY_KEY, cart)
      openDrawerIfCartHasLines(cart)
    },

    onSettled: () => settleWhenIdle(qc),
  })
}

export function useUpdateCartLine() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: CART_MUTATION_KEY,
    mutationFn: (input: { lineId: string; quantity: number }) =>
      updateCartLine({ data: input }),

    onMutate: async (input) => {
      trackMutationStart()
      await qc.cancelQueries({ queryKey: CART_QUERY_KEY })
      const previous = qc.getQueryData<CartDetail | null>(CART_QUERY_KEY)
      if (previous) {
        const nextLines = previous.lines.nodes.map((line) =>
          line.id === input.lineId
            ? { ...line, quantity: input.quantity }
            : line,
        )
        const nextQty = nextLines.reduce((sum, line) => sum + line.quantity, 0)
        qc.setQueryData(CART_QUERY_KEY, {
          ...previous,
          totalQuantity: nextQty,
          lines: { ...previous.lines, nodes: nextLines },
        })
      }
      return { previous }
    },

    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined)
        qc.setQueryData(CART_QUERY_KEY, ctx.previous)
    },

    onSettled: () => settleWhenIdle(qc),
  })
}

export function useRemoveCartLine() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: CART_MUTATION_KEY,
    mutationFn: (input: { lineId: string }) => removeCartLine({ data: input }),

    onMutate: async (input) => {
      trackMutationStart()
      await qc.cancelQueries({ queryKey: CART_QUERY_KEY })
      const previous = qc.getQueryData<CartDetail | null>(CART_QUERY_KEY)
      if (previous) {
        const nextLines = previous.lines.nodes.filter(
          (line) => line.id !== input.lineId,
        )
        const nextQty = nextLines.reduce((sum, line) => sum + line.quantity, 0)
        qc.setQueryData(CART_QUERY_KEY, {
          ...previous,
          totalQuantity: nextQty,
          lines: { ...previous.lines, nodes: nextLines },
        })
      }
      return { previous }
    },

    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined)
        qc.setQueryData(CART_QUERY_KEY, ctx.previous)
    },

    onSettled: () => settleWhenIdle(qc),
  })
}

export function useApplyDiscountCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: CART_MUTATION_KEY,
    mutationFn: (input: { code: string }) =>
      applyDiscountCode({ data: { code: input.code } }),
    onMutate: async () => {
      trackMutationStart()
      await qc.cancelQueries({ queryKey: CART_QUERY_KEY })
    },
    onSuccess: (cart) => {
      qc.setQueryData(CART_QUERY_KEY, cart)
    },
    onSettled: () => settleWhenIdle(qc),
  })
}

export function useRemoveDiscountCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: CART_MUTATION_KEY,
    mutationFn: () => removeDiscountCode(),
    onMutate: async () => {
      trackMutationStart()
      await qc.cancelQueries({ queryKey: CART_QUERY_KEY })
      const previous = qc.getQueryData<CartDetail | null>(CART_QUERY_KEY)
      if (previous) {
        qc.setQueryData(CART_QUERY_KEY, {
          ...previous,
          discountCodes: [],
        })
      }
      return { previous }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined)
        qc.setQueryData(CART_QUERY_KEY, ctx.previous)
    },
    onSettled: () => settleWhenIdle(qc),
  })
}
