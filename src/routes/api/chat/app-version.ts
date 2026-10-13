import { createFileRoute } from '@tanstack/react-router'
import { appBuildId } from '~/chat/core/app-version'
export const Route = createFileRoute('/api/chat/app-version')({ server: { handlers: { GET: () => Response.json({ build: appBuildId }, { headers: { 'Cache-Control': 'no-store' } }) } } })
