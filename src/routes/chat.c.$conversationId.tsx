import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { App } from '~/chat/components/App'
import {
  defaultWorkspaceSearch,
  validateWorkspaceSearch,
} from '~/chat/core/navigation'

export const Route = createFileRoute('/chat/c/$conversationId')({
  validateSearch: validateWorkspaceSearch,
  search: { middlewares: [stripSearchParams(defaultWorkspaceSearch)] },
  component: App,
})
