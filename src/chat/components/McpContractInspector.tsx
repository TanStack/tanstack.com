import { useWorkspaceApi } from './WorkspaceApi'
import { useState } from 'react'
import { CodeBlock } from './MessageMarkdown'

export function McpContractInspector() {
  const { url: apiUrl } = useWorkspaceApi()
  const [serverId, setServerId] = useState('')
  const [entity, setEntity] = useState('')
  const [result, setResult] = useState<unknown>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault()
        setBusy(true)
        setError('')
        setResult(undefined)
        try {
          const response = await fetch(
            apiUrl('mcp/contract?' + new URLSearchParams({ serverId, entity })),
            { signal: AbortSignal.timeout(35000) },
          )
          const data = (await response.json()) as { error?: string }
          if (!response.ok)
            throw new Error(data.error ?? 'Contract read failed.')
          setResult(data)
        } catch (cause) {
          setError(
            cause instanceof Error ? cause.message : 'Contract read failed.',
          )
        } finally {
          setBusy(false)
        }
      }}
    >
      <label>
        Server ID
        <input
          required
          value={serverId}
          onChange={(e) => setServerId(e.target.value)}
          autoComplete="off"
        />
      </label>
      <label>
        Contract reference
        <input
          required
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          autoComplete="off"
        />
      </label>
      <button className="secondary" disabled={busy}>
        {busy ? 'Reading contract…' : 'Read contract'}
      </button>
      {error && <p role="alert">{error}</p>}
      {result !== undefined && (
        <CodeBlock code={JSON.stringify(result, null, 2)} lang="json" />
      )}
    </form>
  )
}
