import type {
  CartDetail,
  CartLineDetail,
  CartLineMerchandise,
} from '~/utils/shopify-queries'

export type AddToCartLineSnapshot = {
  productTitle: string
  productHandle: string
  variantTitle: string
  price: CartLineMerchandise['price']
  image: CartLineMerchandise['image']
  selectedOptions: CartLineMerchandise['selectedOptions']
}

function buildOptimisticLine(
  variantId: string,
  quantity: number,
  snap: AddToCartLineSnapshot,
): CartLineDetail {
  const lineTotal = String(Number(snap.price.amount) * quantity)
  return {
    id: `optimistic-${variantId}`,
    quantity,
    merchandise: {
      id: variantId,
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
  }
}

function emptyOptimisticCart(line: CartLineDetail): CartDetail {
  const money = line.cost.totalAmount
  return {
    id: 'optimistic-cart',
    checkoutUrl: '',
    totalQuantity: line.quantity,
    cost: {
      totalAmount: money,
      subtotalAmount: money,
      totalTaxAmount: null,
    },
    lines: { nodes: [line] },
    discountCodes: [],
  }
}

/**
 * Apply an add-to-cart to a cached cart. Seeds a cart when none exists so
 * the drawer can render the new line before Shopify responds.
 */
export function applyOptimisticAddToCart(
  previous: CartDetail | null | undefined,
  input: {
    variantId: string
    quantity: number
    line?: AddToCartLineSnapshot
  },
): CartDetail | null {
  const { variantId, quantity, line: snap } = input

  if (!snap) {
    if (!previous) return previous ?? null
    return {
      ...previous,
      totalQuantity: (previous.totalQuantity ?? 0) + quantity,
    }
  }

  const newLine = buildOptimisticLine(variantId, quantity, snap)
  if (!previous) return emptyOptimisticCart(newLine)

  const existingIdx = previous.lines.nodes.findIndex(
    (existing) => existing.merchandise.id === variantId,
  )
  const nextLines =
    existingIdx >= 0
      ? previous.lines.nodes.map((existing, index) =>
          index === existingIdx
            ? { ...existing, quantity: existing.quantity + quantity }
            : existing,
        )
      : [newLine, ...previous.lines.nodes]

  return {
    ...previous,
    totalQuantity: nextLines.reduce(
      (sum, existing) => sum + existing.quantity,
      0,
    ),
    lines: { ...previous.lines, nodes: nextLines },
  }
}

export function cartHasLines(cart: CartDetail | null | undefined) {
  return !!cart && cart.lines.nodes.length > 0
}
