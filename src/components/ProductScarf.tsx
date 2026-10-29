import { useRouterState } from '@tanstack/react-router'
import { Scarf } from './Scarf'

import { productScarfPixels } from '~/utils/analytics/scarf-pixels'

export function ProductScarf() {
  const product = useRouterState({
    select: (state) => {
      const pathname = state.resolvedLocation?.pathname
      return productScarfPixels.find(
        ({ path }) => pathname === path || pathname?.startsWith(`${path}/`),
      )
    },
  })

  return product ? <Scarf id={product.id} path={product.path} /> : null
}
