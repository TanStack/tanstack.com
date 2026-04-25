import { createServerFn } from '@tanstack/react-start'
import * as v from 'valibot'
import type { Capability } from '~/db/types'
import {
  adminSetAdsDisabled as adminSetAdsDisabledServer,
  bulkUpdateUserCapabilities as bulkUpdateUserCapabilitiesServer,
  getUser as getUserServer,
  listUsers as listUsersServer,
  removeProfileImage as removeProfileImageServer,
  revertProfileImage as revertProfileImageServer,
  setInterestedInHidingAds as setInterestedInHidingAdsServer,
  updateAdPreference as updateAdPreferenceServer,
  updateLastUsedFramework as updateLastUsedFrameworkServer,
  updateUserCapabilities as updateUserCapabilitiesServer,
} from '~/utils/users.server'

const listUsersInput = v.pipe(
  v.object({
    pagination: v.object({
      limit: v.number(),
      page: v.optional(v.number()),
    }),
    emailFilter: v.optional(v.string()),
    nameFilter: v.optional(v.string()),
    capabilityFilter: v.optional(v.array(v.string())),
    noCapabilitiesFilter: v.optional(v.boolean()),
    adsDisabledFilter: v.optional(v.boolean()),
    interestedInHidingAdsFilter: v.optional(v.boolean()),
    useEffectiveCapabilities: v.optional(v.boolean(), true),
    sortBy: v.optional(v.string()),
    sortDir: v.optional(v.picklist(['asc', 'desc'])),
  }),
  v.transform((data) => ({
    ...data,
    capabilityFilter: data.capabilityFilter as Array<Capability> | undefined,
  })),
)

export const listUsers = createServerFn({ method: 'POST' })
  .inputValidator(listUsersInput)
  .handler(async ({ data }) => listUsersServer({ data }))

export const getUser = createServerFn({ method: 'POST' })
  .inputValidator(v.object({ userId: v.pipe(v.string(), v.uuid()) }))
  .handler(async ({ data }) => getUserServer({ data }))

export const updateAdPreference = createServerFn({ method: 'POST' })
  .inputValidator(v.object({ adsDisabled: v.boolean() }))
  .handler(async ({ data }) => updateAdPreferenceServer({ data }))

export const updateLastUsedFramework = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      framework: v.pipe(v.string(), v.minLength(1), v.maxLength(50)),
    }),
  )
  .handler(async ({ data }) => updateLastUsedFrameworkServer({ data }))

export const updateUserCapabilities = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      userId: v.pipe(v.string(), v.uuid()),
      capabilities: v.array(v.string()),
    }),
  )
  .handler(async ({ data }) =>
    updateUserCapabilitiesServer({
      data: {
        userId: data.userId,
        capabilities: data.capabilities as Array<Capability>,
      },
    }),
  )

export const adminSetAdsDisabled = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      userId: v.pipe(v.string(), v.uuid()),
      adsDisabled: v.boolean(),
    }),
  )
  .handler(async ({ data }) => adminSetAdsDisabledServer({ data }))

export const bulkUpdateUserCapabilities = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      userIds: v.array(v.pipe(v.string(), v.uuid())),
      capabilities: v.array(v.string()),
    }),
  )
  .handler(async ({ data }) =>
    bulkUpdateUserCapabilitiesServer({
      data: {
        userIds: data.userIds,
        capabilities: data.capabilities as Array<Capability>,
      },
    }),
  )

export const setInterestedInHidingAds = createServerFn({ method: 'POST' })
  .inputValidator(v.object({ interested: v.boolean() }))
  .handler(async ({ data }) => setInterestedInHidingAdsServer({ data }))

export const revertProfileImage = createServerFn({ method: 'POST' }).handler(
  async () => revertProfileImageServer(),
)

export const removeProfileImage = createServerFn({ method: 'POST' }).handler(
  async () => removeProfileImageServer(),
)
