import * as React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listMcpApiKeys,
  createMcpApiKey,
  revokeMcpApiKey,
  deleteMcpApiKey,
} from '~/utils/mcpApiKeys.functions'
import {
  listConnectedApps,
  revokeConnectedApp,
} from '~/utils/oauthClient.functions'
import { useToast } from '~/components/ToastProvider'
import { Card } from '~/components/Card'
import { Button } from '~/components/Button'
import { CodeBlock } from '~/components/markdown'
import {
  Key,
  Plus,
  Trash2,
  Ban,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  Link2,
} from 'lucide-react'
export const Route = createFileRoute('/account/integrations')({
  component: IntegrationsPage,
})

function IntegrationsPage() {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const [isCreating, setIsCreating] = React.useState(false)
  const [newKeyName, setNewKeyName] = React.useState('')
  const [expiresInDays, setExpiresInDays] = React.useState<number | undefined>(
    undefined,
  )
  const [newlyCreatedKey, setNewlyCreatedKey] = React.useState<string | null>(
    null,
  )
  const [copied, setCopied] = React.useState(false)

  const keysQuery = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => listMcpApiKeys(),
  })

  const createMutation = useMutation({
    mutationFn: createMcpApiKey,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      setNewlyCreatedKey(data.rawKey)
      setIsCreating(false)
      setNewKeyName('')
      setExpiresInDays(undefined)
      notify(
        <div>
          <div className="font-medium">API key created</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            Copy it now, you won't see it again
          </div>
        </div>,
      )
    },
    onError: (error) => {
      notify(
        <div>
          <div className="font-medium">Error</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            {error instanceof Error ? error.message : 'Failed to create key'}
          </div>
        </div>,
      )
    },
  })

  const revokeMutation = useMutation({
    mutationFn: revokeMcpApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      notify(
        <div>
          <div className="font-medium">API key revoked</div>
        </div>,
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteMcpApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      notify(
        <div>
          <div className="font-medium">API key deleted</div>
        </div>,
      )
    },
  })

  const connectedAppsQuery = useQuery({
    queryKey: ['connected-apps'],
    queryFn: () => listConnectedApps(),
  })

  const revokeAppMutation = useMutation({
    mutationFn: revokeConnectedApp,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connected-apps'] })
      notify(
        <div>
          <div className="font-medium">App access revoked</div>
        </div>,
      )
    },
  })

  const handleCreate = () => {
    if (!newKeyName.trim()) return
    createMutation.mutate({
      data: {
        name: newKeyName.trim(),
        expiresInDays,
      },
    })
  }

  const handleCopy = async () => {
    if (!newlyCreatedKey) return
    await navigator.clipboard.writeText(newlyCreatedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const isExpired = (dateStr: string | null) => {
    if (!dateStr) return false
    return new Date(dateStr) < new Date()
  }

  const formatClientId = (clientId: string) => {
    // Format client IDs for display (e.g., truncate long UUIDs)
    if (clientId.length > 32) {
      return clientId.slice(0, 16) + '...' + clientId.slice(-8)
    }
    return clientId
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">
            API Keys
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create API keys to authenticate with TanStack APIs
          </p>
        </div>
        {!isCreating && (
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="w-3.5 h-3.5" />
            New Key
          </Button>
        )}
      </div>

      {newlyCreatedKey && (
        <Card className="p-4 border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-950/30">
          <div className="flex items-start gap-3">
            <Key className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-green-800 dark:text-green-200 text-sm">
                Your new API key
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                Copy this key now. You won't be able to see it again.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 bg-white dark:bg-gray-900 border border-green-200 dark:border-green-800 rounded px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100 overflow-x-auto">
                  {newlyCreatedKey}
                </code>
                <Button onClick={handleCopy} className="flex-shrink-0">
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <button
                type="button"
                onClick={() => setNewlyCreatedKey(null)}
                className="mt-3 text-xs text-green-700 dark:text-green-300 hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </Card>
      )}

      {isCreating && (
        <Card className="p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-4">
            Create new API key
          </h4>
          <div className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="key-name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Name
              </label>
              <input
                id="key-name"
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., My Claude Desktop"
                className="w-full max-w-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label
                htmlFor="expires"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Expiration (optional)
              </label>
              <select
                id="expires"
                value={expiresInDays ?? ''}
                onChange={(e) =>
                  setExpiresInDays(
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="">Never expires</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreate}
                disabled={!newKeyName.trim() || createMutation.isPending}
                className="bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Key'}
              </Button>
              <Button
                onClick={() => {
                  setIsCreating(false)
                  setNewKeyName('')
                  setExpiresInDays(undefined)
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="divide-y divide-gray-200 dark:divide-gray-700">
        {keysQuery.isLoading ? (
          <div className="p-4 text-sm text-gray-500">Loading...</div>
        ) : keysQuery.data?.length === 0 ? (
          <div className="p-8 text-center">
            <Key className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No API keys yet
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
              Create one to get started
            </p>
          </div>
        ) : (
          keysQuery.data?.map((key) => (
            <div
              key={key.id}
              className="p-4 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`p-2 rounded-lg ${
                    !key.isActive || isExpired(key.expiresAt)
                      ? 'bg-gray-100 dark:bg-gray-800'
                      : 'bg-blue-50 dark:bg-blue-950/30'
                  }`}
                >
                  <Key
                    className={`w-4 h-4 ${
                      !key.isActive || isExpired(key.expiresAt)
                        ? 'text-gray-400'
                        : 'text-blue-600 dark:text-blue-400'
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
                      {key.name}
                    </span>
                    {!key.isActive && (
                      <span className="text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                        Revoked
                      </span>
                    )}
                    {key.isActive && isExpired(key.expiresAt) && (
                      <span className="text-xs px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Expired
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    <code className="font-mono">{key.keyPrefix}...</code>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Created {formatDate(key.createdAt)}
                    </span>
                    {key.lastUsedAt && (
                      <span>Last used {formatDate(key.lastUsedAt)}</span>
                    )}
                    {key.expiresAt && !isExpired(key.expiresAt) && (
                      <span>Expires {formatDate(key.expiresAt)}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {key.isActive && (
                  <Button
                    onClick={() =>
                      revokeMutation.mutate({ data: { keyId: key.id } })
                    }
                    disabled={revokeMutation.isPending}
                    title="Revoke key"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Revoke
                  </Button>
                )}
                <Button
                  onClick={() =>
                    deleteMutation.mutate({ data: { keyId: key.id } })
                  }
                  disabled={deleteMutation.isPending}
                  title="Delete key"
                  className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>

      {/* Connected Apps Section */}
      <div className="flex items-start justify-between mt-4">
        <div>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">
            Connected Apps
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Apps that have access to your account via OAuth
          </p>
        </div>
      </div>

      <Card className="divide-y divide-gray-200 dark:divide-gray-700">
        {connectedAppsQuery.isLoading ? (
          <div className="p-4 text-sm text-gray-500">Loading...</div>
        ) : connectedAppsQuery.data?.length === 0 ? (
          <div className="p-8 text-center">
            <Link2 className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No connected apps
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
              Apps you authorize will appear here
            </p>
          </div>
        ) : (
          connectedAppsQuery.data?.map((app) => (
            <div
              key={app.clientId}
              className="p-4 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/30">
                  <Link2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white text-sm truncate font-mono">
                      {formatClientId(app.clientId)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Connected {formatDate(app.createdAt)}
                    </span>
                    {app.lastUsedAt && (
                      <span>Last used {formatDate(app.lastUsedAt)}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  onClick={() =>
                    revokeAppMutation.mutate({
                      data: { clientId: app.clientId },
                    })
                  }
                  disabled={revokeAppMutation.isPending}
                  title="Revoke access"
                  className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Revoke
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}
