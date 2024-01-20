import type { DocsConfig } from '~/components/Docs'
import { useMatchesData } from '~/utils/utils'

export const repo = 'tanstack/router'

export const v1branch = 'main'

export const gradientText =
  'inline-block text-transparent bg-clip-text bg-gradient-to-r from-lime-500 to-emerald-500'

export const useRouterV1Config = () =>
  useMatchesData('/router/v1') as DocsConfig
