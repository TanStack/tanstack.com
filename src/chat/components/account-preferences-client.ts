import { useQuery } from '@tanstack/react-query'
import {
  accountPreferencesInputSchema,
  accountPreferencesSchema,
  type AccountPreferences,
  type AccountPreferencesInput,
} from '../core/account-preferences'
import { ApiError, workspaceApi } from './WorkspaceApi'

const accountApi = workspaceApi()
export const accountPreferencesKey = (userId: string) =>
  ['account-preferences', userId] as const

export function mergeAccountPreferences(
  previous: AccountPreferences | undefined,
  incoming: AccountPreferences,
) {
  return previous && previous.revision > incoming.revision ? previous : incoming
}

export const accountPreferencesAccessDenied = (error: unknown) =>
  error instanceof ApiError && [401, 403, 404].includes(error.status)

export function accountPreferencesQueryOptions(userId: string) {
  return {
    queryKey: accountPreferencesKey(userId),
    queryFn: async () =>
      accountPreferencesSchema.parse(
        await accountApi.request('account/preferences'),
      ),
    staleTime: 0,
    retry: false,
    structuralSharing: (previous: unknown, incoming: unknown) =>
      mergeAccountPreferences(
        previous as AccountPreferences | undefined,
        incoming as AccountPreferences,
      ),
  }
}

export function useAccountPreferences(userId: string) {
  return useQuery(accountPreferencesQueryOptions(userId))
}

export function confirmedAccountTimezone(preferences?: AccountPreferences) {
  return preferences?.timezone != null &&
    preferences.timezoneConfirmedAt != null
    ? preferences.timezone
    : undefined
}

export async function saveAccountPreferences(input: AccountPreferencesInput) {
  return accountPreferencesSchema.parse(
    await accountApi.request(
      'account/preferences',
      accountPreferencesInputSchema.parse(input),
    ),
  )
}
