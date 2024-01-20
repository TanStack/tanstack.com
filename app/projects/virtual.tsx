import type { DocsConfig } from '~/components/Docs'
import { useMatchesData } from '~/utils/utils'

export const v3branch = 'main'

export const useVirtualV3Config = () =>
  useMatchesData('/virtual/v3') as DocsConfig

export const gradientText =
  'inline-block text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-violet-600'
