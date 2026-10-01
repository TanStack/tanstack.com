import { useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  kodyServerAddResultSchema,
  kodyServerAddSchema,
  type KodyServerAdd,
} from '../core/kody-servers'
import { ApiError, useWorkspaceApi } from './WorkspaceApi'
import { Button } from './ui/Button'

export function KodyAddServer({ userId }: { userId: string }) {
  const { request, workspaceId } = useWorkspaceApi()
  const queries = useQueryClient()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [authUrl, setAuthUrl] = useState<string>()
  const pending = useRef<KodyServerAdd | null>(null)
  const locked = useRef(false)

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (locked.current) return
    const parsed = kodyServerAddSchema.safeParse({
      operationId: pending.current?.operationId ?? crypto.randomUUID(),
      name: name.trim(),
      url: url.trim(),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the server details.')
      return
    }
    pending.current = parsed.data
    locked.current = true
    setBusy(true)
    setError('')
    setAuthUrl(undefined)
    try {
      const result = kodyServerAddResultSchema.parse(
        await request('kody/servers', parsed.data),
      )
      pending.current = null
      setName('')
      setUrl('')
      setAuthUrl(result.authUrl)
      if (!result.authUrl && !result.connected)
        setError(
          result.error ??
            `Kody saved ${result.name}, but it is not connected yet.`,
        )
      void queries.invalidateQueries({
        queryKey: ['kody-account', userId, workspaceId],
      })
      void queries.invalidateQueries({
        queryKey: ['reference-catalog', userId, workspaceId],
      })
    } catch (cause) {
      if (cause instanceof ApiError && cause.status < 500)
        pending.current = null
      setError(
        cause instanceof Error ? cause.message : 'Kody server setup failed.',
      )
      void queries.invalidateQueries({
        queryKey: ['kody-account', userId, workspaceId],
      })
    } finally {
      locked.current = false
      setBusy(false)
    }
  }

  return (
    <details className="connection-kody-section">
      <summary>Add MCP server to Kody</summary>
      <form className="connection-form connection-kody-add" onSubmit={add}>
        <fieldset disabled={busy}>
          <label>
            Name
            <input
              required
              maxLength={64}
              placeholder="my-server"
              pattern="[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?"
              value={name}
              onChange={(event) => {
                pending.current = null
                setName(event.target.value)
              }}
            />
          </label>
          <label>
            MCP server address
            <input
              required
              type="url"
              maxLength={500}
              placeholder="https://example.com/mcp"
              value={url}
              onChange={(event) => {
                pending.current = null
                setUrl(event.target.value)
              }}
            />
          </label>
          <Button type="submit" variant="secondary">
            {busy ? 'Adding…' : 'Add to Kody'}
          </Button>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        {authUrl && (
          <a href={authUrl} target="_blank" rel="noreferrer">
            Continue sign-in at {new URL(authUrl).hostname}
          </a>
        )}
      </form>
    </details>
  )
}
