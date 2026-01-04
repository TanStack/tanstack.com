import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const ADMIN_EMAIL = 'tanner@tanstack.com'
const FROM_EMAIL = 'TanStack <notifications@tanstack.com>'

type AdminNotification = {
  subject: string
  text: string
  html?: string
}

export async function notifyAdmin({ subject, text, html }: AdminNotification) {
  if (!resend) {
    console.log('[Email] Resend not configured, skipping notification:', {
      subject,
      text,
    })
    return
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `[TanStack] ${subject}`,
      text,
      html: html || text.replace(/\n/g, '<br>'),
    })
  } catch (error) {
    console.error('[Email] Failed to send admin notification:', error)
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

export function formatUserSignupEmail(user: {
  name?: string | null
  email: string
  provider: string
}) {
  const subject = `New User: ${user.name || user.email}`
  const text = `A new user has signed up.

Name: ${user.name || 'Not provided'}
Email: ${user.email}
Provider: ${user.provider}

View users at: https://tanstack.com/admin/users`

  return { subject, text }
}
