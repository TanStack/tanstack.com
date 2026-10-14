import { and, eq } from 'drizzle-orm'
import { db } from '~/db/client'
import { chatCredentials } from '~/db/schema'
import type { Credentials } from '../core/types'
import { seal, unseal } from './crypto'

export interface CredentialEnv {
  ENCRYPTION_KEY: string
}

export async function readCredentials(
  env: CredentialEnv,
  userId: string,
): Promise<Credentials | null> {
  const [row] = await db
    .select({ ciphertext: chatCredentials.ciphertext })
    .from(chatCredentials)
    .where(eq(chatCredentials.userId, userId))
  return row ? unseal<Credentials>(row.ciphertext, env.ENCRYPTION_KEY) : null
}

export async function writeCredentials(
  env: CredentialEnv,
  userId: string,
  value: Credentials,
) {
  const ciphertext = await seal(value, env.ENCRYPTION_KEY)
  await db
    .insert(chatCredentials)
    .values({ userId, ciphertext })
    .onConflictDoUpdate({ target: chatCredentials.userId, set: { ciphertext } })
}

/** Source compare-and-swap protocol, preserving concurrent account updates. */
export async function updateCredentials(
  env: CredentialEnv,
  userId: string,
  update: (current: Credentials | null) => Credentials,
): Promise<Credentials> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const [row] = await db
      .select({ ciphertext: chatCredentials.ciphertext })
      .from(chatCredentials)
      .where(eq(chatCredentials.userId, userId))
    const current = row
      ? await unseal<Credentials>(row.ciphertext, env.ENCRYPTION_KEY)
      : null
    const next = update(current)
    const ciphertext = await seal(next, env.ENCRYPTION_KEY)
    const saved = row
      ? await db
          .update(chatCredentials)
          .set({ ciphertext })
          .where(
            and(
              eq(chatCredentials.userId, userId),
              eq(chatCredentials.ciphertext, row.ciphertext),
            ),
          )
          .returning({ userId: chatCredentials.userId })
      : await db
          .insert(chatCredentials)
          .values({ userId, ciphertext })
          .onConflictDoNothing()
          .returning({ userId: chatCredentials.userId })
    if (saved.length === 1) return next
  }
  throw new Error('Account settings changed while saving. Try again.')
}
