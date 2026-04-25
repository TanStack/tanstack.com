import { createServerFn } from '@tanstack/react-start'
import * as v from 'valibot'
import {
  deleteIntentPackage as deleteIntentPackageServer,
  discoverViaGitHub as discoverViaGitHubServer,
  getIntentAdminStats as getIntentAdminStatsServer,
  listFailedVersions as listFailedVersionsServer,
  listIntentPackages as listIntentPackagesServer,
  resetFailedVersions as resetFailedVersionsServer,
  retryIntentVersion as retryIntentVersionServer,
  seedIntentPackage as seedIntentPackageServer,
  triggerIntentDiscover as triggerIntentDiscoverServer,
  triggerIntentProcess as triggerIntentProcessServer,
} from '~/utils/intent-admin.server'

export const getIntentAdminStats = createServerFn({ method: 'GET' }).handler(
  async () => getIntentAdminStatsServer(),
)

export const listIntentPackages = createServerFn({ method: 'GET' }).handler(
  async () => listIntentPackagesServer(),
)

export const listFailedVersions = createServerFn({ method: 'GET' }).handler(
  async () => listFailedVersionsServer(),
)

export const triggerIntentDiscover = createServerFn({ method: 'POST' }).handler(
  async () => triggerIntentDiscoverServer(),
)

export const triggerIntentProcess = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      limit: v.optional(v.number(), 10),
    }),
  )
  .handler(async ({ data }) => triggerIntentProcessServer({ data }))

export const retryIntentVersion = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      versionId: v.number(),
    }),
  )
  .handler(async ({ data }) => retryIntentVersionServer({ data }))

export const deleteIntentPackage = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      name: v.string(),
    }),
  )
  .handler(async ({ data }) => deleteIntentPackageServer({ data }))

export const resetFailedVersions = createServerFn({ method: 'POST' }).handler(
  async () => resetFailedVersionsServer(),
)

export const seedIntentPackage = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      name: v.string(),
    }),
  )
  .handler(async ({ data }) => seedIntentPackageServer({ data }))

export const discoverViaGitHub = createServerFn({ method: 'POST' }).handler(
  async () => discoverViaGitHubServer(),
)
