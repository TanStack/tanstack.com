import { createFileRoute } from '@tanstack/react-router'

// The workspace shell owns the conversation view, so changing bots preserves
// the surrounding navigation and dialogs.
export const Route = createFileRoute('/chat/w/$workspaceId/b/$botId')({})
