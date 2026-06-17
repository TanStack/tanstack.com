import * as d3 from 'd3'

import type { BinType } from './shared'

export const binningOptionsByType = {
  yearly: {
    label: 'Yearly',
    value: 'yearly',
    single: 'year',
    bin: d3.utcYear,
  },
  monthly: {
    label: 'Monthly',
    value: 'monthly',
    single: 'month',
    bin: d3.utcMonth,
  },
  weekly: {
    label: 'Weekly',
    value: 'weekly',
    single: 'week',
    bin: d3.utcWeek,
  },
  daily: {
    label: 'Daily',
    value: 'daily',
    single: 'day',
    bin: d3.utcDay,
  },
} as const satisfies Record<
  BinType,
  {
    label: string
    value: BinType
    single: string
    bin: (date: Date) => Date
  }
>
