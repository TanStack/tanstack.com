import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { twMerge } from 'tailwind-merge'
import { getProduct } from '~/utils/shop.functions'
import {
  findExactVariant,
  findMatchingVariant,
  hasAvailableVariant,
  type ProductDetail,
} from '~/utils/shopify-queries'
import { formatMoney } from '~/utils/shopify-format'
import { resolveShopProductColor, shopColorContrast } from '~/utils/shop-color'
import { ProductImage } from './ProductImage'
import {
  ShopButton,
  ShopChip,
  ShopLabel,
  ShopMono,
  ShopQty,
  ShopSelect,
  ShopSize,
} from './ui'
import { useAddToCart } from '~/hooks/useCart'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '~/components/ds/ui'

const MAX_INLINE_OPTION_VALUES = 8

const ARROW_CLS =
  'absolute top-1/2 z-[3] flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-shop-line bg-shop-bg/90 text-shop-text shadow-xl backdrop-blur-sm transition-[transform,background-color] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-standard)] hover:bg-shop-surface-hover active:scale-95 motion-reduce:transition-none'

type ProductDrawerProps = {
  productHandle: string | null
  initialProduct?: ProductDetail | null
  allHandles: string[]
  onClose: () => void
  onChange: (handle: string) => void
}

function getInitialProduct(
  handle: string | null,
  product: ProductDetail | null | undefined,
) {
  if (!handle || product?.handle !== handle) return undefined
  return product
}

export function ProductDrawer({
  productHandle,
  initialProduct,
  allHandles,
  onClose,
  onChange,
}: ProductDrawerProps) {
  const isOpen = !!productHandle
  const queryClient = useQueryClient()

  // Keep the last-known handle alive through the exit animation so the drawer
  // slides out with content visible (not empty). Uses the derived-state pattern
  // so displayHandle is updated synchronously on open (no empty-frame flash).
  const [displayHandle, setDisplayHandle] = React.useState<string | null>(
    productHandle,
  )
  const [prevProductHandle, setPrevProductHandle] = React.useState<
    string | null
  >(productHandle)
  const [lastReadyHandle, setLastReadyHandle] = React.useState<string | null>(
    null,
  )
  const [animatedProductHandle, setAnimatedProductHandle] = React.useState<
    string | null
  >(null)
  if (productHandle !== prevProductHandle) {
    setPrevProductHandle(productHandle)
    if (productHandle) setDisplayHandle(productHandle)
  }

  // Clear displayHandle after exit animation completes
  React.useEffect(() => {
    if (!productHandle) {
      const t = setTimeout(() => {
        setDisplayHandle(null)
        setLastReadyHandle(null)
        setAnimatedProductHandle(null)
      }, 400)
      return () => clearTimeout(t)
    }
  }, [productHandle])

  // Pre-fetch product data so the drawer only animates open once content is ready,
  // preventing the skeleton flash. Same query key as DrawerBody so cache is shared.
  const { data: prefetchedProduct } = useQuery({
    queryKey: ['shopify', 'product', displayHandle ?? ''],
    queryFn: () => getProduct({ data: { handle: displayHandle! } }),
    enabled: !!displayHandle,
    initialData: getInitialProduct(displayHandle, initialProduct),
    placeholderData: (previousProduct) => previousProduct,
    staleTime: 5 * 60 * 1000,
  })

  // Keep the previous query data visible until the next product is ready.
  const visibleProduct = displayHandle ? prefetchedProduct : null

  // Stagger only product-to-product swaps. On first open, the sheet entrance is
  // the only motion so the content and container never compete visually.
  if (visibleProduct && visibleProduct.handle !== lastReadyHandle) {
    setAnimatedProductHandle(lastReadyHandle ? visibleProduct.handle : null)
    setLastReadyHandle(visibleProduct.handle)
  }
  const shouldAnimateContent = animatedProductHandle === visibleProduct?.handle

  // Wait for data on the first open, but keep the sheet visible while products swap.
  const hasOpened = React.useRef(false)
  if (isOpen && prefetchedProduct) hasOpened.current = true
  if (!isOpen && !displayHandle) hasOpened.current = false
  const isAnimatedOpen = isOpen && hasOpened.current

  const navigateStep = React.useCallback(
    (dir: number) => {
      if (!productHandle || allHandles.length === 0) return
      const idx = allHandles.indexOf(productHandle)
      const next = (idx + dir + allHandles.length) % allHandles.length
      const nextHandle = allHandles[next]
      if (nextHandle) onChange(nextHandle)
    },
    [productHandle, allHandles, onChange],
  )

  // Keep neighboring product details warm so arrow navigation feels immediate.
  React.useEffect(() => {
    if (!productHandle || allHandles.length < 2) return
    const currentIndex = allHandles.indexOf(productHandle)
    if (currentIndex < 0) return

    const neighborHandles = [
      allHandles[(currentIndex - 1 + allHandles.length) % allHandles.length],
      allHandles[(currentIndex + 1) % allHandles.length],
    ]

    for (const handle of neighborHandles) {
      if (!handle) continue
      void queryClient.prefetchQuery({
        queryKey: ['shopify', 'product', handle],
        queryFn: () => getProduct({ data: { handle } }),
        staleTime: 5 * 60 * 1000,
      })
    }
  }, [allHandles, productHandle, queryClient])

  // Arrow-key navigation between products. Escape, focus trapping, focus
  // restoration and scroll lock all come from the DS Drawer now.
  React.useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') navigateStep(1)
      if (e.key === 'ArrowLeft') navigateStep(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, navigateStep])

  return (
    <Drawer
      open={isAnimatedOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DrawerContent
        side="bottom"
        fit
        className={twMerge(
          'shop-scope shop-product-sheet border-shop-line text-shop-text',
          // Wins over the DS `fit` cap via twMerge, so the sheet keeps its own
          // navbar-aware height rather than the generic 85dvh.
          'max-h-[calc(100svh-var(--shop-product-sheet-top))]',
        )}
      >
        {/* The sheet has no visible title bar, so the accessible name is
            supplied directly rather than through DrawerHeader. */}
        <DrawerTitle className="sr-only">
          {visibleProduct?.title ?? 'Product detail'}
        </DrawerTitle>
        <DrawerDescription className="sr-only">
          Product details, options and add to cart.
        </DrawerDescription>

        <DrawerClose
          aria-label="Close product detail"
          title="Close (Esc)"
          className="absolute top-3 left-3 z-[3] p-1 text-shop-muted transition-colors hover:text-shop-text"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path
              d="M2 2l10 10M12 2L2 12"
              stroke="currentColor"
              strokeWidth="1.6"
            />
          </svg>
        </DrawerClose>

        {allHandles.length > 1 ? (
          <>
            {/* Anchored to the panel, not the viewport. Radix traps focus
                inside the panel, so viewport-level siblings would be
                unreachable by keyboard — and it retires the third z-tier the
                overlay audit flagged. */}
            <button
              type="button"
              aria-label="View previous product"
              title="Previous product (Left arrow)"
              onClick={() => navigateStep(-1)}
              className={twMerge(ARROW_CLS, 'left-4')}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
                <path
                  d="M12.5 4.5 7 10l5.5 5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.75"
                />
              </svg>
            </button>
            <button
              type="button"
              aria-label="View next product"
              title="Next product (Right arrow)"
              onClick={() => navigateStep(1)}
              className={twMerge(ARROW_CLS, 'right-4')}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
                <path
                  d="m7.5 4.5 5.5 5.5-5.5 5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.75"
                />
              </svg>
            </button>
          </>
        ) : null}

        {/* Keep the sheet mounted; only replace its product content. */}
        {visibleProduct ? (
          <div className="flex min-h-0 flex-1">
            <ProductPanel
              key={visibleProduct.handle}
              product={visibleProduct}
              animateIn={shouldAnimateContent}
            />
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  )
}

/* ─── Full product content ────────────────────────────────────────────── */

function ProductPanel({
  product,
  animateIn,
}: {
  product: ProductDetail
  animateIn: boolean
}) {
  const variants = product.variants.nodes
  const selectableOptions = product.options.filter((o) => o.values.length > 1)

  const [selected, setSelected] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      product.options.map((o) => [
        o.name,
        o.values.length === 1 ? (o.values[0] ?? '') : '',
      ]),
    ),
  )
  const [quantity, setQuantity] = React.useState(1)
  const [activeImageIndex, setActiveImageIndex] = React.useState(0)
  const [showAdded, setShowAdded] = React.useState(false)
  // heroOverride: set to variant image when user picks a color; cleared on thumbnail click
  const [heroOverride, setHeroOverride] = React.useState<
    (typeof product.images.nodes)[0] | null
  >(null)

  // Exact variant for add-to-cart; wildcard findMatchingVariant used only for chip availability
  const selectedVariant = findExactVariant(variants, selected)
  // True once the user has explicitly picked every option (color, size, etc.)
  const isComplete = product.options
    .filter((o) => o.values.length > 1)
    .every((o) => !!selected[o.name])

  // Sync hero image when color selection changes — uses wildcard match so image
  // updates immediately on color pick even before size is chosen.
  const variantForImage = findMatchingVariant(variants, selected)
  React.useEffect(() => {
    if (variantForImage?.image) setHeroOverride(variantForImage.image)
    else setHeroOverride(null)
  }, [variantForImage?.id, variantForImage?.image, variantForImage?.image?.url])

  // Resolve which thumbnail index is "active" — match override url into the list
  const heroOverrideIndex = heroOverride
    ? product.images.nodes.findIndex((img) => img.url === heroOverride.url)
    : -1
  const activeThumbnailIndex = heroOverride
    ? heroOverrideIndex
    : activeImageIndex
  const heroImage =
    heroOverride ?? product.images.nodes[activeImageIndex] ?? null

  const displayPrice = selectedVariant?.price ?? variants[0]?.price ?? null

  const selectOption = (optionIndex: number, name: string, value: string) => {
    setSelected((current) => ({
      ...current,
      ...Object.fromEntries(
        selectableOptions.slice(optionIndex + 1).map((o) => [o.name, '']),
      ),
      [name]: value,
    }))
  }

  const addToCart = useAddToCart()

  React.useEffect(() => {
    if (!showAdded) return
    const id = window.setTimeout(() => setShowAdded(false), 1500)
    return () => window.clearTimeout(id)
  }, [showAdded])

  return (
    <div
      className={twMerge(
        'shop-product-drawer-shell flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--shop-line)_transparent]',
        animateIn && 'shop-product-animate',
      )}
    >
      <div className="shop-product-drawer-layout">
        {/* Hero image + horizontal thumbnail carousel */}
        <div className="shop-product-drawer-media relative">
          <div className="shop-product-drawer-main-image aspect-square bg-shop-bg/40 backdrop-blur-[20px] relative overflow-hidden p-6">
            {heroImage ? (
              <ProductImage
                image={heroImage}
                alt={product.title}
                width={1200}
                sizes="(min-width: 1120px) 60vw, (min-width: 768px) 520px, 100vw"
                loading="eager"
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>

          {/* Thumbnail carousel */}
          {product.images.nodes.length > 1 ? (
            <div className="shop-product-drawer-thumbs flex gap-2 overflow-x-auto border-t border-shop-line bg-shop-bg/40 px-4 py-3 [scrollbar-width:none]">
              {product.images.nodes.map((img, i) => (
                <button
                  key={`${img.url}-${i}`}
                  type="button"
                  onClick={() => {
                    setActiveImageIndex(i)
                    setHeroOverride(null)
                  }}
                  aria-label={`View image ${i + 1}`}
                  className={twMerge(
                    'w-[80px] aspect-square rounded-md overflow-hidden transition-opacity shrink-0',
                    i === activeThumbnailIndex
                      ? 'opacity-100 ring-1 ring-shop-line-2'
                      : 'opacity-45 hover:opacity-75',
                  )}
                >
                  <ProductImage
                    image={img}
                    alt={`${product.title} — image ${i + 1}`}
                    width={160}
                    sizes="15vw"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="shop-product-drawer-details bg-shop-bg">
          <div className="mx-3 border-t border-shop-line" />

          {/* Title + price */}
          <div className="shop-product-reveal shop-product-reveal-heading shop-product-drawer-heading flex justify-between items-baseline gap-3 px-6">
            <h2 className="shop-product-drawer-title font-shop-display font-semibold leading-tight tracking-[-0.015em] text-shop-text">
              {product.title}
            </h2>
            {displayPrice ? (
              <ShopMono className="shop-product-drawer-price text-shop-text whitespace-nowrap shrink-0">
                {formatMoney(displayPrice.amount, displayPrice.currencyCode)}
              </ShopMono>
            ) : null}
          </div>

          {/* COLOR + SIZE + QUANTITY — all on one flex-wrap row */}
          <div className="shop-product-drawer-options flex flex-col gap-5 items-start px-6 py-5">
            {selectableOptions.map((option, optionIndex) => {
              const isSizeOption = /size/i.test(option.name)
              const shouldUseSelect =
                option.values.length > MAX_INLINE_OPTION_VALUES
              const isEnabled = selectableOptions
                .slice(0, optionIndex)
                .every((o) => !!selected[o.name])
              const getCandidate = (value: string) => ({
                ...Object.fromEntries(
                  selectableOptions
                    .slice(0, optionIndex)
                    .map((o) => [o.name, selected[o.name]]),
                ),
                [option.name]: value,
              })

              if (shouldUseSelect) {
                return (
                  <div
                    key={option.id}
                    className="shop-product-reveal shop-product-option flex flex-col gap-3"
                  >
                    <ShopLabel as="span" className="italic">
                      {option.name}
                    </ShopLabel>
                    <ShopSelect
                      value={selected[option.name]}
                      disabled={!isEnabled}
                      className="w-full"
                      triggerClassName="w-full justify-between rounded-full px-4 py-2 text-shop-sm"
                      onChange={(e) =>
                        selectOption(optionIndex, option.name, e.target.value)
                      }
                    >
                      <option value="" disabled>
                        Select {option.name}
                      </option>
                      {option.values.map((value) => {
                        return (
                          <option
                            key={value}
                            value={value}
                            disabled={
                              !hasAvailableVariant(
                                variants,
                                getCandidate(value),
                              )
                            }
                          >
                            {value}
                          </option>
                        )
                      })}
                    </ShopSelect>
                  </div>
                )
              }

              if (isSizeOption) {
                return (
                  <div
                    key={option.id}
                    className="shop-product-reveal shop-product-option flex flex-col gap-3"
                  >
                    <ShopLabel as="span" className="italic">
                      {option.name}
                    </ShopLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {option.values.map((value) => {
                        const isSelected = selected[option.name] === value
                        const isUnavailable = !hasAvailableVariant(
                          variants,
                          getCandidate(value),
                        )
                        return (
                          <ShopSize
                            key={value}
                            isSelected={isSelected}
                            isUnavailable={isUnavailable}
                            disabled={!isEnabled}
                            onClick={() =>
                              selectOption(optionIndex, option.name, value)
                            }
                            className={twMerge(
                              'shop-product-option-control w-auto rounded-full px-4 py-2 leading-none whitespace-nowrap',
                              !isEnabled && 'opacity-40 cursor-not-allowed',
                            )}
                          >
                            {value}
                          </ShopSize>
                        )
                      })}
                    </div>
                  </div>
                )
              }

              // Color / other options
              return (
                <div
                  key={option.id}
                  className="shop-product-reveal shop-product-option flex flex-col gap-3"
                >
                  <ShopLabel as="span" className="italic">
                    {option.name}
                  </ShopLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {option.values.map((value) => {
                      const isSelected = selected[option.name] === value
                      const isUnavailable = !hasAvailableVariant(
                        variants,
                        getCandidate(value),
                      )
                      const hex = resolveShopProductColor(value)
                      return (
                        <ShopChip
                          key={value}
                          isSelected={isSelected}
                          isUnavailable={isUnavailable}
                          disabled={!isEnabled}
                          selectedBg={hex}
                          selectedTextColor={
                            hex ? shopColorContrast(hex) : undefined
                          }
                          onClick={() =>
                            selectOption(optionIndex, option.name, value)
                          }
                          className={twMerge(
                            'shop-product-option-control rounded-full px-4 py-2 font-shop-mono leading-none whitespace-nowrap',
                            !isEnabled && 'opacity-40 cursor-not-allowed',
                          )}
                        >
                          {value}
                        </ShopChip>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* Quantity pill */}
            <div className="shop-product-reveal shop-product-quantity flex flex-col gap-3 shrink-0">
              <ShopLabel as="span" className="italic">
                Quantity
              </ShopLabel>
              <ShopQty
                quantity={quantity}
                min={1}
                onChange={setQuantity}
                className="shop-product-quantity-control rounded-full bg-shop-surface border-shop-line"
              />
            </div>
          </div>

          <div className="mx-3 border-t border-shop-line" />

          {/* Add to Cart */}
          <div className="shop-product-reveal shop-product-reveal-cta flex flex-col items-center px-6 py-5">
            <ShopButton
              variant="primary"
              disabled={
                !isComplete ||
                !selectedVariant?.availableForSale ||
                addToCart.isPending
              }
              onClick={() => {
                if (!selectedVariant) return
                setShowAdded(true)
                addToCart.mutate({
                  variantId: selectedVariant.id,
                  quantity,
                  line: {
                    productTitle: product.title,
                    productHandle: product.handle,
                    variantTitle: selectedVariant.title,
                    price: selectedVariant.price,
                    image: selectedVariant.image,
                    selectedOptions: selectedVariant.selectedOptions,
                  },
                })
              }}
              style={
                isComplete && !showAdded && selectedVariant?.availableForSale
                  ? {
                      backgroundImage: 'var(--gradient-commerce-cta)',
                      backgroundSize: '200% 200%',
                      animation:
                        'shop-cta-gradient 12s ease infinite, shop-cta-rotate 30s linear infinite',
                    }
                  : undefined
              }
              className={twMerge(
                'w-full max-w-[760px] rounded-full px-4 py-3 flex items-center justify-center gap-2.5',
                'font-shop-display font-semibold text-shop-title',
                'transition-[background-color,color,border-color,opacity] duration-500',
                isComplete && !showAdded && selectedVariant?.availableForSale
                  ? 'hover:enabled:brightness-105 text-black'
                  : isComplete && !selectedVariant?.availableForSale
                    ? 'bg-shop-surface text-shop-muted border border-shop-line'
                    : 'bg-shop-surface/30 border border-shop-line text-shop-muted cursor-not-allowed',
              )}
            >
              {isComplete && !showAdded && selectedVariant?.availableForSale ? (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                  <path d="M3 6h18" />
                  <path d="M16 10a4 4 0 01-8 0" />
                </svg>
              ) : null}
              {showAdded
                ? '✓ Added'
                : !isComplete
                  ? 'Add to Cart'
                  : !selectedVariant?.availableForSale
                    ? 'Sold out'
                    : 'Add to Cart'}
            </ShopButton>
          </div>

          <div className="mx-3 border-t border-shop-line" />

          {/* Description */}
          {product.descriptionHtml ? (
            <div className="shop-product-reveal shop-product-reveal-description flex flex-col gap-2.5 px-6 py-4">
              <span className="font-shop-mono italic text-shop-sm text-shop-muted uppercase tracking-[0.1em]">
                Description
              </span>
              <div
                className="shop-product-description text-shop-body text-shop-text-2 leading-[1.6] [&_p]:mb-2 [&_p:last-child]:mb-0"
                dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
