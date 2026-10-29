import { z } from 'zod'
import { historyDaysSchema } from './scarf-history'
import { loadScarfHistory } from './scarf-history.server'
import { requireAdmin } from '~/utils/roles.server'
import { createServerFn } from '@tanstack/react-start'
import { listLiveVisitors, listLiveCompanyOverview } from './live.server'
import { getLiveConfig } from './scarf-lookup.server'

export const getLiveVisitors = createServerFn({ method: 'GET' }).handler(
  async () => listLiveVisitors(),
)

export const getLiveVisitorsEnabled = createServerFn({ method: 'GET' }).handler(
  async () => (await getLiveConfig()).enabled,
)

export const getLiveCompanyOverview = createServerFn({ method: 'GET' }).handler(
  async () => listLiveCompanyOverview(),
)
export const getLiveCompanySessions = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      domain: z
        .string()
        .max(253)
        .regex(/^(?:[a-z0-9.-]+)?$/),
    }),
  )
  .handler(async ({ data }) => listLiveVisitors(data.domain))
export const getScarfCompanyHistory = createServerFn({ method: 'GET' })
  .validator(z.object({ days: historyDaysSchema }))
  .handler(async ({ data }) => {
    await requireAdmin()
    return loadScarfHistory(data.days)
  })
