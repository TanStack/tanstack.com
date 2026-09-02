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

function moneyMinorUnits(amount: string) {
  const dot = amount.indexOf('.')
  if (dot === -1) return { units: BigInt(amount), scale: 0 }
  const fraction = amount.slice(dot + 1)
  return {
    units: BigInt(amount.slice(0, dot) + fraction),
    scale: fraction.length,
  }
}

function formatMinorUnits(units: bigint, scale: number) {
  if (scale === 0) return String(units)
  const digits = units.toString().padStart(scale + 1, '0')
  const splitAt = digits.length - scale
  return `${digits.slice(0, splitAt)}.${digits.slice(splitAt)}`
}

function multiplyMoney(amount: string, quantity: number) {
  const { units, scale } = moneyMinorUnits(amount)
  return formatMinorUnits(units * BigInt(quantity), scale)
}

function addMoney(left: string, right: string) {
  const a = moneyMinorUnits(left)
  const b = moneyMinorUnits(right)
  const scale = Math.max(a.scale, b.scale)
  const leftUnits = a.units * 10n ** BigInt(scale - a.scale)
  const rightUnits = b.units * 10n ** BigInt(scale - b.scale)
  return formatMinorUnits(leftUnits + rightUnits, scale)
}

function buildOptimisticLine(
  variantId: string,
  quantity: number,
  snap: AddToCartLineSnapshot,
): CartLineDetail {
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
        amount: multiplyMoney(snap.price.amount, quantity),
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
      checkoutUrl: '',
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
      ? previous.lines.nodes.map((existing, index) => {
          if (index !== existingIdx) return existing
          const nextQty = existing.quantity + quantity
          return {
            ...existing,
            quantity: nextQty,
            cost: {
              totalAmount: {
                amount: multiplyMoney(
                  existing.merchandise.price.amount,
                  nextQty,
                ),
                currencyCode: existing.cost.totalAmount.currencyCode,
              },
            },
          }
        })
      : [newLine, ...previous.lines.nodes]

  const currencyCode = previous.cost.totalAmount.currencyCode
  const summed = nextLines.reduce(
    (sum, existing) => addMoney(sum, existing.cost.totalAmount.amount),
    '0',
  )
  return {
    ...previous,
    checkoutUrl: '',
    totalQuantity: nextLines.reduce(
      (sum, existing) => sum + existing.quantity,
      0,
    ),
    cost: {
      ...previous.cost,
      totalAmount: { amount: summed, currencyCode },
      subtotalAmount: { amount: summed, currencyCode },
    },
    lines: { ...previous.lines, nodes: nextLines },
  }
}

export function cartHasLines(cart: CartDetail | null | undefined) {
  return !!cart && cart.lines.nodes.length > 0
}
