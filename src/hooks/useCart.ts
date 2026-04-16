import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
 * Mutation key shared across all cart-mutating hooks. Used by
 * `settleWhenIdle` to determine whether other cart mutations are still
 * in flight before triggering a background refetch.
 */
const CART_MUTATION_KEY = ['shopify', 'cart', 'mutate'] as const

/**
 * Only invalidate (refetch from server) when no other cart mutations are
 * in flight. This prevents a settled mutation's refetch from overwriting
 * another mutation's optimistic state with stale server data.
 *
 * Each `onMutate` reads the *current* cache (which may already reflect
 * earlier optimistic writes) and layers its own change on top. When the
 * last mutation settles, the refetch reconciles everything with the
 * server's final truth.
 */
function settleWhenIdle(qc: ReturnType<typeof useQueryClient>) {
  // isMutating counts mutations that haven't settled yet. At the time
  // onSettled fires, the *current* mutation has already decremented, so
  // 0 means "I was the last one."
  if (qc.isMutating({ mutationKey: CART_MUTATION_KEY }) === 0) {
    qc.invalidateQueries({ queryKey: CART_QUERY_KEY })
  }
}

/**
 * Read the current cart. Data is loader-seeded on shop routes, so there is
 * no hydration gap — components that call this render with real data on the
 * first frame. On non-shop routes the hook falls back to fetching on mount.
 */
export function useCart() {
  const query = useQuery<CartDetail | null>({
    queryKey: CART_QUERY_KEY,
    queryFn: () => getCart(),
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

export function useAddToCart() {
  const qc = useQueryClient()

  return useMutation({
    mutationKey: CART_MUTATION_KEY,
    mutationFn: (input: { variantId: string; quantity?: number }) =>
      addToCart({
        data: { variantId: input.variantId, quantity: input.quantity ?? 1 },
      }),

    onMutate: async (input) => {
      const quantity = input.quantity ?? 1
      await qc.cancelQueries({ queryKey: CART_QUERY_KEY })
      const previous = qc.getQueryData<CartDetail | null>(CART_QUERY_KEY)
      if (previous) {
        qc.setQueryData<CartDetail | null>(CART_QUERY_KEY, {
          ...previous,
          totalQuantity: (previous.totalQuantity ?? 0) + quantity,
        })
      }
      return { previous }
    },

    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined)
        qc.setQueryData(CART_QUERY_KEY, ctx.previous)
    },

    // Add-to-cart needs onSuccess to populate the new line item in the
    // cache — onMutate can only bump totalQuantity since it doesn't have
    // the full product data. Unlike remove/update, rapid-fire adds are
    // rare, and the worst case is a brief badge-count fluctuation.
    onSuccess: (cart) => {
      qc.setQueryData(CART_QUERY_KEY, cart)
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
      await qc.cancelQueries({ queryKey: CART_QUERY_KEY })
      const previous = qc.getQueryData<CartDetail | null>(CART_QUERY_KEY)
      if (previous) {
        const nextLines = previous.lines.nodes.map((line) =>
          line.id === input.lineId
            ? { ...line, quantity: input.quantity }
            : line,
        )
        const nextQty = nextLines.reduce((sum, line) => sum + line.quantity, 0)
        qc.setQueryData<CartDetail | null>(CART_QUERY_KEY, {
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
      await qc.cancelQueries({ queryKey: CART_QUERY_KEY })
      const previous = qc.getQueryData<CartDetail | null>(CART_QUERY_KEY)
      if (previous) {
        const nextLines = previous.lines.nodes.filter(
          (line) => line.id !== input.lineId,
        )
        const nextQty = nextLines.reduce((sum, line) => sum + line.quantity, 0)
        qc.setQueryData<CartDetail | null>(CART_QUERY_KEY, {
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
    onSuccess: (cart) => {
      // Discount apply has no optimistic state, so setting server
      // response here is safe — it only adds information.
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
      await qc.cancelQueries({ queryKey: CART_QUERY_KEY })
      const previous = qc.getQueryData<CartDetail | null>(CART_QUERY_KEY)
      if (previous) {
        qc.setQueryData<CartDetail | null>(CART_QUERY_KEY, {
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
