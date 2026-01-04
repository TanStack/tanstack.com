import { Resend } from 'resend'
import { db } from '~/db/client'
import { users, roles, roleAssignments } from '~/db/schema'
import { eq, sql } from 'drizzle-orm'
import type { Capability } from '~/db/types'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM_EMAIL = 'TanStack <notifications@tanstack.com>'

type ModeratorNotification = {
  capability: Capability
  subject: string
  text: string
  html?: string
}

/**
 * Get email addresses of users who have a specific capability.
 * This checks both direct user capabilities and role-based capabilities.
 * Does NOT include users who only have 'admin' capability.
 */
async function getUserEmailsWithCapability(
  capability: Capability,
): Promise<string[]> {
  // Query users who have the capability directly OR via a role
  // Explicitly check for the specific capability, not 'admin'
  const result = await db
    .select({
      email: users.email,
    })
    .from(users)
    .leftJoin(roleAssignments, eq(roleAssignments.userId, users.id))
    .leftJoin(roles, eq(roles.id, roleAssignments.roleId))
    .where(
      sql`(
        ${capability} = ANY(${users.capabilities})
        OR ${capability} = ANY(${roles.capabilities})
      )`,
    )

  // Deduplicate emails (user might match via multiple roles)
  const emails = [...new Set(result.map((r) => r.email))]
  return emails
}

export async function notifyModerators({
  capability,
  subject,
  text,
  html,
}: ModeratorNotification) {
  const emails = await getUserEmailsWithCapability(capability)

  if (emails.length === 0) {
    console.log(
      `[Email] No moderators with ${capability} capability, skipping notification:`,
      { subject },
    )
    return
  }

  if (!resend) {
    console.log('[Email] Resend not configured, skipping notification:', {
      subject,
      text,
      to: emails,
    })
    return
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: emails,
      subject: `[TanStack] ${subject}`,
      text,
      html: html || text.replace(/\n/g, '<br>'),
    })
  } catch (error) {
    console.error('[Email] Failed to send moderator notification:', error)
  }
}

export function formatShowcaseSubmittedEmail(showcase: {
  name: string
  url: string
  tagline: string
  libraries: string[]
  userName?: string
}) {
  const subject = `New Showcase: ${showcase.name}`
  const text = `A new showcase has been submitted for review.

Name: ${showcase.name}
URL: ${showcase.url}
Tagline: ${showcase.tagline}
Libraries: ${showcase.libraries.join(', ')}
Submitted by: ${showcase.userName || 'Unknown'}

Review it at: https://tanstack.com/admin/showcases`

  return { subject, text }
}

export function formatFeedbackSubmittedEmail(feedback: {
  type: 'note' | 'improvement'
  pagePath: string
  libraryId: string
  content: string
  userName?: string
}) {
  const subject = `New ${feedback.type === 'note' ? 'Note' : 'Improvement'}: ${feedback.libraryId}`
  const text = `New documentation feedback submitted.

Type: ${feedback.type}
Library: ${feedback.libraryId}
Page: ${feedback.pagePath}
By: ${feedback.userName || 'Unknown'}

Content:
${feedback.content}

Review it at: https://tanstack.com/admin/feedback`

  return { subject, text }
}
