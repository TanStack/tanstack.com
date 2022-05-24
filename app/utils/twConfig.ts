import resolveConfig from 'tailwindcss/resolveConfig'
import { TailwindConfig } from 'tailwindcss/tailwind-config.js'
// @ts-ignore
import tailwindConfig from '../../tailwind.config.js'

export const twConfig = resolveConfig(tailwindConfig) as TailwindConfig & {
  theme: {
    colors: Record<string, Record<string, string>>
  }
}

// twConfig.theme.colors.yellow[500]
