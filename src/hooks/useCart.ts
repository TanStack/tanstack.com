import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addToCart,
  getCart,
  removeCartLine,
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
    mutationFn: (input: { variantId: string; quantity?: number }) =>
      addToCart({
        data: { variantId: input.variantId, quantity: input.quantity ?? 1 },
      }),

    // Bump totalQuantity immediately so the navbar badge moves in the same
    // frame the user clicks. We can't optimistically render new line items
    // without the full product snapshot, which callers don't have here —
    // the refetch on settle fills that in.
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

    onSuccess: (cart) => {
      qc.setQueryData(CART_QUERY_KEY, cart)
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: CART_QUERY_KEY })
    },
  })
}

export function useUpdateCartLine() {
  const qc = useQueryClient()
  return useMutation({
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

    onSuccess: (cart) => {
      qc.setQueryData(CART_QUERY_KEY, cart)
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: CART_QUERY_KEY })
    },
  })
}

export function useRemoveCartLine() {
  const qc = useQueryClient()
  return useMutation({
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

    onSuccess: (cart) => {
      qc.setQueryData(CART_QUERY_KEY, cart)
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: CART_QUERY_KEY })
    },
  })
}
