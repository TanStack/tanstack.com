import * as React from 'react'
import { Button } from '~/components/ds/ui'
import { startBuilderOpenRouterLogin } from '~/utils/builder-openrouter-login.client'
import type { BuilderAiByokConnection } from '~/utils/builder-ai-api-key-storage.client'

export function BuilderOpenRouterConnect({
  onSave,
  connection,
}: {
  onSave: (key: string) => Promise<boolean>
  connection: BuilderAiByokConnection
}) {
  const [pendingKey, setPendingKey] = React.useState<string>()
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const controller = React.useRef<AbortController | undefined>(undefined)
  React.useEffect(() => {
    setPendingKey(undefined)
    return () => controller.current?.abort()
  }, [connection])

  async function connect() {
    if (controller.current) return
    const attempt = new AbortController()
    controller.current = attempt
    setBusy(true)
    setError('')
    try {
      const key = await startBuilderOpenRouterLogin(attempt.signal)
      if (!attempt.signal.aborted) setPendingKey(key)
    } catch (cause) {
      if (!attempt.signal.aborted) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not connect OpenRouter.',
        )
      }
    } finally {
      if (controller.current === attempt) {
        controller.current = undefined
        setBusy(false)
      }
    }
  }

  async function save() {
    if (!pendingKey || busy) return
    setBusy(true)
    try {
      if (await onSave(pendingKey)) setPendingKey(undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">
        Use your OpenRouter credits across models. Paid models require a funded
        OpenRouter account.
      </p>
      {pendingKey ? (
        <>
          <p className="text-xs text-text-muted">
            Save the connection to finish. Your browser may ask for a passkey.
          </p>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? 'Saving…' : 'Save OpenRouter connection'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => setPendingKey(undefined)}
          >
            Cancel
          </Button>
        </>
      ) : (
        <>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void connect()}
          >
            {busy ? 'Waiting for OpenRouter…' : 'Connect OpenRouter'}
          </Button>
          {busy ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => controller.current?.abort()}
            >
              Cancel
            </Button>
          ) : null}
        </>
      )}
      {error ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  )
}
