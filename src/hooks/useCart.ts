import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addToCart,
  applyDiscountCode,
  getCart,
  removeCartLine,
  removeDiscountCode,
  updateCartLine,
} from '~/utils/shop.functions'
import type { CartDetail, CartLineDetail } from '~/utils/shopify-queries'

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
 *
 * Returns the invalidation promise so the mutation stays in `isPending`
 * until the background refetch completes (per TkDodo's recommendation).
 *
 * @see https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query
 */
function settleWhenIdle(qc: ReturnType<typeof useQueryClient>) {
  // isMutating counts mutations that haven't settled yet. At the time
  // onSettled fires, the *current* mutation is still counted, so
  // 1 means "I'm the last one in flight."
  if (qc.isMutating({ mutationKey: CART_MUTATION_KEY }) === 1) {
    return qc.invalidateQueries({ queryKey: CART_QUERY_KEY })
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

/**
 * Snapshot of the product/variant from the PDP, passed through to
 * onMutate so a full optimistic cart line can be rendered instantly.
 */
type AddToCartLineSnapshot = {
  productTitle: string
  productHandle: string
  variantTitle: string
  price: { amount: string; currencyCode: string }
  image: {
    url: string
    altText?: string | null
    width?: number | null
    height?: number | null
  } | null
  selectedOptions: Array<{ name: string; value: string }>
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
    mutationKey: CART_MUTATION_KEY,
    mutationFn: (input: AddToCartInput) =>
      addToCart({
        data: { variantId: input.variantId, quantity: input.quantity ?? 1 },
      }),

    onMutate: async (input) => {
      const quantity = input.quantity ?? 1
      await qc.cancelQueries({ queryKey: CART_QUERY_KEY })
      const previous = qc.getQueryData<CartDetail | null>(CART_QUERY_KEY)

      if (previous && input.line) {
        const snap = input.line

        // Does this variant already have a line in the cart?
        const existingIdx = previous.lines.nodes.findIndex(
          (l) => l.merchandise.id === input.variantId,
        )

        let nextLines: CartDetail['lines']['nodes']
        if (existingIdx >= 0) {
          nextLines = previous.lines.nodes.map((l, i) =>
            i === existingIdx ? { ...l, quantity: l.quantity + quantity } : l,
          )
        } else {
          const lineTotal = String(Number(snap.price.amount) * quantity)
          nextLines = [
            ...previous.lines.nodes,
            {
              id: `optimistic-${Date.now()}`,
              quantity,
              merchandise: {
                id: input.variantId,
                title: snap.variantTitle,
                availableForSale: true,
                selectedOptions: snap.selectedOptions,
                price: snap.price,
                image: snap.image,
                product: {
                  handle: snap.productHandle,
                  title: snap.productTitle,
                },
              },
              cost: {
                totalAmount: {
                  amount: lineTotal,
                  currencyCode: snap.price.currencyCode,
                },
              },
            } as CartLineDetail,
          ]
        }

        qc.setQueryData<CartDetail | null>(CART_QUERY_KEY, {
          ...previous,
          totalQuantity: nextLines.reduce((s, l) => s + l.quantity, 0),
          lines: { ...previous.lines, nodes: nextLines },
        })
      } else if (previous) {
        // No snapshot — fall back to just bumping the count
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

    // Reconcile: replace the optimistic line (temporary ID, approximate
    // totals) with the real server response.
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
    onMutate: async () => {
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
