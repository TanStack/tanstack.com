/** Distinguishes TanChat' account maintenance reads from user-requested runs. */
export const KODY_INTERNAL_READ_PREFIX = 'banks-internal-read-'

export function kodyInternalReadArgs<T extends Record<string, unknown>>(
  args: T,
): T & { idempotencyKey: string } {
  if (args.idempotencyKey)
    throw new Error('An internal Kody read already has an idempotency key.')
  return {
    ...args,
    idempotencyKey: `${KODY_INTERNAL_READ_PREFIX}${crypto.randomUUID()}`,
  }
}
