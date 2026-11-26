import { and, eq, lt } from 'drizzle-orm'
import { db } from '~/db/client'
import { chatAccountPreferences, users } from '~/db/schema'
import {
  accountPreferencesInputSchema,
  accountPreferencesSchema,
  defaultResponsePreferences,
} from '../core/account-preferences'
import { defaultAppearance } from '../core/appearance'

export class AccountPreferencesError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 409,
  ) {
    super(message)
    this.name = 'AccountPreferencesError'
  }
}

function snapshot(row: {
  timezone: string | null
  revision: number | null
  timezoneConfirmedAt: number | null
  response: typeof chatAccountPreferences.$inferSelect.response
  appearance: typeof chatAccountPreferences.$inferSelect.appearance
}) {
  return accountPreferencesSchema.parse({
    timezone: row.timezone,
    timezoneConfirmedAt: row.timezoneConfirmedAt,
    revision: row.revision ?? 0,
    response: row.response ?? defaultResponsePreferences,
    appearance: row.appearance ?? defaultAppearance,
  })
}

/** Authenticated user identity comes from the site session, never the input body. */
export async function readAccountPreferences(userId: string) {
  const [row] = await db
    .select({
      timezone: chatAccountPreferences.timezone,
      revision: chatAccountPreferences.revision,
      timezoneConfirmedAt: chatAccountPreferences.timezoneConfirmedAt,
      response: chatAccountPreferences.response,
      appearance: chatAccountPreferences.appearance,
    })
    .from(users)
    .leftJoin(
      chatAccountPreferences,
      eq(chatAccountPreferences.userId, users.id),
    )
    .where(eq(users.id, userId))
  if (!row) throw new AccountPreferencesError('Account not found.', 404)
  return snapshot(row)
}

export async function updateAccountPreferences(userId: string, input: unknown) {
  const value = accountPreferencesInputSchema.parse(input)
  const current = await readAccountPreferences(userId)
  const conflict = () =>
    new AccountPreferencesError(
      'Your account preferences changed. Reload them before saving.',
      409,
    )
  if (value.revision !== current.revision) throw conflict()
  const timezone =
    value.timezone === undefined ? current.timezone : value.timezone
  const response = value.response ?? current.response
  const appearance = value.appearance ?? current.appearance ?? defaultAppearance
  const timezoneChanged = timezone !== current.timezone
  if (
    !timezoneChanged &&
    JSON.stringify(response) === JSON.stringify(current.response) &&
    JSON.stringify(appearance) === JSON.stringify(current.appearance)
  )
    return current
  if (value.revision >= Number.MAX_SAFE_INTEGER) throw conflict()
  const next = {
    timezone,
    response,
    appearance,
    revision: value.revision + 1,
    timezoneConfirmedAt: timezoneChanged
      ? timezone === null
        ? null
        : Date.now()
      : current.timezoneConfirmedAt,
  }
  const where = and(
    eq(chatAccountPreferences.userId, userId),
    eq(chatAccountPreferences.revision, value.revision),
    lt(chatAccountPreferences.revision, Number.MAX_SAFE_INTEGER),
  )
  const rows =
    value.revision === 0
      ? await db
          .insert(chatAccountPreferences)
          .values({ userId, ...next })
          .onConflictDoUpdate({
            target: chatAccountPreferences.userId,
            set: next,
            where,
          })
          .returning()
      : await db
          .update(chatAccountPreferences)
          .set(next)
          .where(where)
          .returning()
  if (!rows[0]) throw conflict()
  return snapshot(rows[0])
}
