import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { App } from '~/chat/components/App'
import {
  validateWorkspaceSearch,
  defaultWorkspaceSearch,
} from '~/chat/core/navigation'

export const Route = createFileRoute('/chat/w/$workspaceId')({
  validateSearch: validateWorkspaceSearch,
  search: { middlewares: [stripSearchParams(defaultWorkspaceSearch)] },
  component: App,
})
