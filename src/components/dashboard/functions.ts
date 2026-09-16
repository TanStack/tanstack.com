import { dashboardStorage, withDashboardCache } from './server/cache'
import { createServerFn } from '@tanstack/react-start'
import { serverRequestSchema } from './request'
import { readDashboard } from './server/queries'
import { withDatabase } from './server/database'
export const fetchDashboard = createServerFn({ method: 'POST' })
  .validator(serverRequestSchema)
  .handler(async ({ data }) =>
    withDashboardCache(data, await dashboardStorage(), () =>
      withDatabase((execute) => readDashboard(execute, data)),
    ),
  )
