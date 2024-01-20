import type { DocsConfig } from '~/components/Docs'
import { useMatchesData } from '~/utils/utils'

export const repo = 'tanstack/table'

export const v8branch = 'main'

export const gradientText =
  'inline-block text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-blue-600'

export const useReactTableV8Config = () =>
  useMatchesData('/table/v8') as DocsConfig
