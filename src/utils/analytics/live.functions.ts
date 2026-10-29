import { createServerFn } from '@tanstack/react-start'
import { listLiveVisitors } from './live.server'
import { getLiveConfig } from './scarf-lookup.server'

export const getLiveVisitors = createServerFn({ method: 'GET' }).handler(
  async () => listLiveVisitors(),
)

export const getLiveVisitorsEnabled = createServerFn({ method: 'GET' }).handler(
  async () => (await getLiveConfig()).enabled,
)
