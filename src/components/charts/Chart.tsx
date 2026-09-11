import {
  Chart as RendererChart,
  type ChartProps,
} from '@tanstack/charts/react/core'
import { motion } from '@tanstack/charts/motion'
import type { ChartValue } from '@tanstack/charts'

// One renderer policy for every chart rendered by the site. Definitions can
// still refine their own motion without duplicating application defaults.
export const chartRenderer = motion({
  transition: { type: 'spring', stiffness: 170, damping: 26, mass: 1 },
  respectReducedMotion: true,
})

export function Chart<
  TDatum,
  TXValue extends ChartValue,
  TYValue extends ChartValue,
>(props: Omit<ChartProps<TDatum, TXValue, TYValue>, 'renderer'>) {
  return <RendererChart {...props} renderer={chartRenderer} />
}
