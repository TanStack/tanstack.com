import type { PendingTask } from '../core/tasks'
import { Link } from '@tanstack/react-router'
import { Button, ButtonLink } from './ui/Button'
import { ActionCard } from './ui/ActionCard'
import { MessageMarkdown } from './MessageMarkdown'

function isInternalSetup(url: string) {
  return url.startsWith('/') && !url.startsWith('//')
}

export function PendingTaskCard({
  task,
  guide,
  busy,
  disabled = false,
  onContinue,
  onDismiss,
}: {
  task: PendingTask
  guide?: { content: string; excerpted: boolean }
  busy: boolean
  disabled?: boolean
  onContinue: () => Promise<void>
  onDismiss: () => Promise<void>
}) {
  const internalSetup = isInternalSetup(task.url)
  return (
    <ActionCard
      title={task.title}
      description={task.instructions}
      disabled={busy || disabled}
      onDismiss={() => void onDismiss()}
      children={
        guide ? (
          <details className="pending-task-guide" open>
            <summary>
              {guide.excerpted
                ? 'Kody package setup guide excerpt'
                : 'Kody package setup guide'}
            </summary>
            <div className="pending-task-guide-content">
              <MessageMarkdown httpsLinksOnly>{guide.content}</MessageMarkdown>
            </div>
          </details>
        ) : undefined
      }
      actions={
        <>
          {internalSetup ? (
            <ButtonLink variant="primary" render={<Link to={task.url} />}>
              Open setup
            </ButtonLink>
          ) : (
            <ButtonLink
              variant="primary"
              href={task.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open setup
            </ButtonLink>
          )}
          <Button
            disabled={busy || disabled}
            aria-busy={busy || undefined}
            onClick={() => void onContinue()}
          >
            {busy ? 'Checking…' : 'Continue'}
          </Button>
        </>
      }
    />
  )
}
