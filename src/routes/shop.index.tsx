import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ShopBrowsePage,
  loadShopBrowsePage,
  shopBrowseSearchSchema,
} from './-shop-browse'
import { seo } from '~/utils/seo'

const PRODUCT_DRAWER_EXIT_MS = 420

function getClosedActiveHandle(): string | null {
  return null
}

export const Route = createFileRoute('/shop/')({
  validateSearch: shopBrowseSearchSchema,
  loaderDeps: ({ search }) => ({ sort: search.sort }),
  loader: ({ deps }) => loadShopBrowsePage(deps.sort),
  head: () => ({
    meta: seo({
      title: 'TanStack Shop',
      description:
        'Official TanStack apparel, accessories, and stickers. Show your support and rep your favorite open-source toolkit.',
    }),
  }),
  component: ShopIndex,
  staticData: {
    includeSearchInCanonical: true,
  },
})

function ShopIndex() {
  const { page, sortId } = Route.useLoaderData()
  const navigate = useNavigate({ from: '/shop' })
  const search = Route.useSearch()
  const [activeHandle, setActiveHandle] = React.useState(getClosedActiveHandle)
  const [shouldNavigateAfterClose, setShouldNavigateAfterClose] =
    React.useState(false)

  React.useEffect(() => {
    const productHandle = search.product
    if (!productHandle) {
      setActiveHandle(null)
      setShouldNavigateAfterClose(false)
      return
    }
    const frame = requestAnimationFrame(() => setActiveHandle(productHandle))
    setShouldNavigateAfterClose(false)
    return () => cancelAnimationFrame(frame)
  }, [search.product])

  React.useEffect(() => {
    if (!shouldNavigateAfterClose || activeHandle) return
    const timeout = setTimeout(() => {
      navigate({
        to: '/shop',
        search: (prev) => ({ ...prev, product: undefined }),
        resetScroll: false,
      })
    }, PRODUCT_DRAWER_EXIT_MS)
    return () => clearTimeout(timeout)
  }, [activeHandle, navigate, shouldNavigateAfterClose])

  const openProduct = (handle: string) => {
    navigate({
      to: '/shop',
      search: (prev) => ({ ...prev, product: handle }),
      mask: {
        to: '/shop/$handle',
        params: { handle },
        unmaskOnReload: true,
      },
      resetScroll: false,
    })
  }

  return (
    <ShopBrowsePage
      page={page}
      sortId={sortId}
      activeType={search.type}
      productHandle={activeHandle}
      onTypeChange={(type) =>
        navigate({
          to: '/shop',
          search: (prev) => ({ ...prev, type }),
        })
      }
      onSortChange={(sort) =>
        navigate({
          to: '/shop',
          search: (prev) => ({ ...prev, sort }),
        })
      }
      onProductSelect={openProduct}
      onProductClose={() => {
        setActiveHandle(null)
        setShouldNavigateAfterClose(true)
      }}
      onProductChange={openProduct}
    />
  )
}
