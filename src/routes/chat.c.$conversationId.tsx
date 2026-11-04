import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { AppRoute } from '~/chat/components/AppRoute'
import {
  defaultWorkspaceSearch,
  validateWorkspaceSearch,
} from '~/chat/core/navigation'

export const Route = createFileRoute('/chat/c/$conversationId')({
  validateSearch: validateWorkspaceSearch,
  search: { middlewares: [stripSearchParams(defaultWorkspaceSearch)] },
  component: AppRoute,
})
