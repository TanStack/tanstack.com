import { db } from '~/db/client'
import { oauthAccounts, users } from '~/db/schema'
import { eq, and } from 'drizzle-orm'
import type { OAuthProvider, NewOAuthAccount } from '~/db/schema'

type OAuthProfile = {
  id: string
  email: string
  name?: string
  image?: string
}

// Get OAuth account by provider and account ID
export async function getOAuthAccount(
  provider: OAuthProvider,
  providerAccountId: string
) {
  const account = await db.query.oauthAccounts.findFirst({
    where: and(
      eq(oauthAccounts.provider, provider),
      eq(oauthAccounts.providerAccountId, providerAccountId)
    ),
  })

  return account
}

// Upsert OAuth account and user
export async function upsertOAuthAccount(
  provider: OAuthProvider,
  profile: OAuthProfile
) {
  // Check if OAuth account already exists
  const existingAccount = await getOAuthAccount(provider, profile.id)

  if (existingAccount) {
    // Account exists, update user info if needed
    const user = await db.query.users.findFirst({
      where: eq(users.id, existingAccount.userId),
    })

    if (user) {
      const updates: {
        email?: string
        name?: string
        image?: string
      } = {}

      if (profile.email && user.email !== profile.email) {
        updates.email = profile.email
      }
      if (profile.name && user.name !== profile.name) {
        updates.name = profile.name
      }
      if (profile.image && user.image !== profile.image) {
        updates.image = profile.image
      }

      if (Object.keys(updates).length > 0) {
        await db
          .update(users)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(users.id, existingAccount.userId))
      }
    }

    return {
      userId: existingAccount.userId,
      isNewUser: false,
    }
  }

  // Find user by email (for linking multiple OAuth providers)
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, profile.email),
  })

  let userId: string

  if (existingUser) {
    // Link OAuth account to existing user
    userId = existingUser.id

    // Update user info if provided
    const updates: {
      name?: string
      image?: string
    } = {}

    if (profile.name && !existingUser.name) {
      updates.name = profile.name
    }
    if (profile.image && !existingUser.image) {
      updates.image = profile.image
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(users)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(users.id, userId))
    }
  } else {
    // Create new user
    const [newUser] = await db
      .insert(users)
      .values({
        email: profile.email,
        name: profile.name,
        image: profile.image,
        capabilities: [],
        displayUsername: profile.name,
      })
      .returning()

    userId = newUser.id
  }

  // Create OAuth account link
  const newOAuthAccount: NewOAuthAccount = {
    userId,
    provider,
    providerAccountId: profile.id,
    email: profile.email,
  }

  await db.insert(oauthAccounts).values(newOAuthAccount)

  return {
    userId,
    isNewUser: !existingUser,
  }
}
