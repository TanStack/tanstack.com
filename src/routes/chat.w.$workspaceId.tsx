import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { AppRoute } from '~/chat/components/AppRoute'
import {
  validateWorkspaceSearch,
  defaultWorkspaceSearch,
} from '~/chat/core/navigation'

export const Route = createFileRoute('/chat/w/$workspaceId')({
  validateSearch: validateWorkspaceSearch,
  search: { middlewares: [stripSearchParams(defaultWorkspaceSearch)] },
  component: AppRoute,
})
