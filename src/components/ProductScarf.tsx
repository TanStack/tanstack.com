import { useRouterState } from '@tanstack/react-router'
import { Scarf } from './Scarf'

const products = [
  { path: '/application-starter', id: 'ed471ec3-aa08-430f-8481-258b3a1f94dc' },
  { path: '/builder', id: 'aa4dcee9-86a2-49b4-9981-40c97cc1f55b' },
  { path: '/stats/npm', id: 'e729f879-e127-48e1-be19-c68f6786c9e8' },
  { path: '/intent/registry', id: '811c34af-38bd-4f06-9762-3f58dea0650a' },
]

export function ProductScarf() {
  const product = useRouterState({
    select: (state) => {
      const pathname = state.resolvedLocation?.pathname
      return products.find(
        ({ path }) => pathname === path || pathname?.startsWith(`${path}/`),
      )
    },
  })

  return product ? <Scarf id={product.id} path={product.path} /> : null
}
