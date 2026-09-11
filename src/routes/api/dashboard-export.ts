import { createFileRoute } from '@tanstack/react-router'
import { exportRequestSchema, streamDashboardCsv } from '~/components/dashboard/server/export'

export const Route = createFileRoute('/api/dashboard-export')({
  server: { handlers: {
    POST: async ({ request }) => {
      const origin = request.headers.get('origin')
      if (origin && origin !== new URL(request.url).origin)
        return new Response('Cross-origin export is not allowed.', { status: 403 })
      let body: unknown
      try {
        if (request.headers.get('content-type')?.includes('application/json'))
          body = await request.json()
        else {
          const payload = (await request.formData()).get('payload')
          body = typeof payload === 'string' ? JSON.parse(payload) : null
        }
      } catch {
        return Response.json({ error: 'Invalid export request' }, { status: 400 })
      }
      const parsed = exportRequestSchema.safeParse(body)
      if (!parsed.success)
        return Response.json({ error: 'Invalid export request' }, { status: 400 })
      try {
        return await streamDashboardCsv(parsed.data)
      } catch {
        return new Response('Export could not start. Return to the dashboard and retry.', { status: 503 })
      }
    },
  } },
})
