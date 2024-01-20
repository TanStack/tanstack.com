import type { DocsConfig } from '~/components/Docs'
import { useMatchesData } from '~/utils/utils'

export const repo = 'tanstack/ranger'

export const v1branch = 'main'

export const gradientText =
  'inline-block text-transparent bg-clip-text bg-gradient-to-r from-lime-500 to-emerald-500'

export const useRangerV1Config = () =>
  useMatchesData('/ranger/v1') as DocsConfig
