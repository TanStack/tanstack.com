import type { Library } from './types'
import { categoryStyles } from './categories'

export const reactChartsProject = {
  id: 'react-charts',
  name: 'React Charts',
  ...categoryStyles.tooling,
  to: 'https://react-charts.tanstack.com',
  tagline: `Simple, immersive & interactive charts for React`,
  description: `Flexible, declarative, and highly configurable charts designed to pragmatically display dynamic data.`,
} as Library
