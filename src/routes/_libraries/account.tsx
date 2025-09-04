import {
  FaSignOutAlt,
  FaPlus,
  FaEdit,
  FaTrash,
  FaToggleOn,
  FaToggleOff,
  FaKey,
} from 'react-icons/fa'
import { Authenticated, Unauthenticated, useMutation } from 'convex/react'
import { Link, redirect } from '@tanstack/react-router'
import { authClient } from '~/utils/auth.client'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { api } from 'convex/_generated/api'
import * as React from 'react'
import {
  getLLMKeysForDisplay,
  createLLMKey,
  updateLLMKey,
  deleteLLMKey,
  toggleLLMKeyStatus,
  type LLMKey,
} from '~/utils/llmKeys'

export const Route = createFileRoute({
  component: AccountPage,
})

interface LLMKeyForm {
  provider: 'openai' | 'anthropic'
  keyName: string
  apiKey: string
  isActive: boolean
}

function LLMKeysSection() {
  const [showCreateModal, setShowCreateModal] = React.useState(false)
  const [showEditModal, setShowEditModal] = React.useState(false)
  const [editingKey, setEditingKey] = React.useState<LLMKey | null>(null)
  const [formData, setFormData] = React.useState<LLMKeyForm>({
    provider: 'openai',
    keyName: '',
    apiKey: '',
    isActive: true,
  })
  const [llmKeys, setLlmKeys] = React.useState<
    Array<Omit<LLMKey, 'apiKey'> & { apiKey: string }>
  >([])
  const [refreshTrigger, setRefreshTrigger] = React.useState(0)

  // Load keys from localStorage
  React.useEffect(() => {
    setLlmKeys(getLLMKeysForDisplay())
  }, [refreshTrigger])

  const refreshKeys = () => setRefreshTrigger((prev) => prev + 1)

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      createLLMKey({
        provider: formData.provider,
        keyName: formData.keyName,
        apiKey: formData.apiKey,
        isActive: formData.isActive,
      })
      setShowCreateModal(false)
      resetForm()
      refreshKeys()
    } catch (error) {
      console.error('Error creating LLM key:', error)
      alert('Failed to create LLM key')
    }
  }

  const handleUpdateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingKey) return

    try {
      updateLLMKey(editingKey.id, {
        provider: formData.provider,
        keyName: formData.keyName,
        apiKey: formData.apiKey || undefined,
        isActive: formData.isActive,
      })
      setShowEditModal(false)
      setEditingKey(null)
      resetForm()
      refreshKeys()
    } catch (error) {
      console.error('Error updating LLM key:', error)
      alert('Failed to update LLM key')
    }
  }

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this LLM key?')) return

    try {
      deleteLLMKey(keyId)
      refreshKeys()
    } catch (error) {
      console.error('Error deleting LLM key:', error)
      alert('Failed to delete LLM key')
    }
  }

  const handleToggleStatus = async (keyId: string) => {
    try {
      toggleLLMKeyStatus(keyId)
      refreshKeys()
    } catch (error) {
      console.error('Error toggling LLM key status:', error)
      alert('Failed to toggle LLM key status')
    }
  }

  const openEditModal = (key: LLMKey) => {
    setEditingKey(key)
    setFormData({
      provider: key.provider,
      keyName: key.keyName,
      apiKey: '', // Don't pre-fill the API key for security
      isActive: key.isActive,
    })
    setShowEditModal(true)
  }

  const resetForm = () => {
    setFormData({
      provider: 'openai',
      keyName: '',
      apiKey: '',
      isActive: true,
    })
  }

  const closeModals = () => {
    setShowCreateModal(false)
    setShowEditModal(false)
    setEditingKey(null)
    resetForm()
  }

  const providers = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg text-gray-900 dark:text-white">
          <FaKey className="inline mr-2" />
          LLM API Keys
        </h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          <FaPlus className="text-xs" />
          Add Key
        </button>
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Bring your own API keys for LLM services. Keys are stored securely and
        only visible to you.
      </div>

      {/* Keys List */}
      {llmKeys.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg">
          No API keys configured yet. Add one to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {llmKeys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {key.provider}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {key.keyName}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      key.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}
                  >
                    {key.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-sm font-mono text-gray-600 dark:text-gray-400">
                  {key.apiKey}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleStatus(key.id)}
                  className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    key.isActive ? 'text-green-600' : 'text-red-600'
                  }`}
                  title={key.isActive ? 'Deactivate' : 'Activate'}
                >
                  {key.isActive ? <FaToggleOn /> : <FaToggleOff />}
                </button>
                <button
                  onClick={() => openEditModal(key as LLMKey)}
                  className="p-1 text-blue-600 hover:text-blue-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="Edit"
                >
                  <FaEdit />
                </button>
                <button
                  onClick={() => handleDeleteKey(key.id)}
                  className="p-1 text-red-600 hover:text-red-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="Delete"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              Add LLM API Key
            </h2>
            <form onSubmit={handleCreateKey}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Provider
                </label>
                <select
                  value={formData.provider}
                  onChange={(e) =>
                    setFormData({ ...formData, provider: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                >
                  {providers.map((provider) => (
                    <option key={provider.value} value={provider.value}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Key Name
                </label>
                <input
                  type="text"
                  value={formData.keyName}
                  onChange={(e) =>
                    setFormData({ ...formData, keyName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="e.g., My OpenAI Key"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) =>
                    setFormData({ ...formData, apiKey: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter API key"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Active
                  </span>
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModals}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              Edit LLM API Key
            </h2>
            <form onSubmit={handleUpdateKey}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Provider
                </label>
                <select
                  value={formData.provider}
                  onChange={(e) =>
                    setFormData({ ...formData, provider: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                >
                  {providers.map((provider) => (
                    <option key={provider.value} value={provider.value}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Key Name
                </label>
                <input
                  type="text"
                  value={formData.keyName}
                  onChange={(e) =>
                    setFormData({ ...formData, keyName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="e.g., My OpenAI Key"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Key (leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) =>
                    setFormData({ ...formData, apiKey: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter new API key (optional)"
                />
              </div>
              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Active
                  </span>
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModals}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Update Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function UserSettings() {
  const userQuery = useCurrentUserQuery()
  // Use current user query directly instead of separate ad preference query
  const updateAdPreferenceMutation = useMutation(
    api.users.updateAdPreference
  ).withOptimisticUpdate((localStore, args) => {
    const { adsDisabled } = args
    const currentValue = localStore.getQuery(api.auth.getCurrentUser)
    if (currentValue !== undefined) {
      localStore.setQuery(api.auth.getCurrentUser, {}, {
        ...currentValue,
        adsDisabled: adsDisabled,
      } as any)
    }
  })

  // Get values directly from the current user data
  const adsDisabled = userQuery.data?.adsDisabled ?? false
  const canDisableAds =
    userQuery.data?.capabilities.includes('disableAds') ?? false

  const handleToggleAds = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateAdPreferenceMutation({
      adsDisabled: e.target.checked,
    })
  }

  const signOut = async () => {
    await authClient.signOut()
    redirect({ to: '/login' })
  }

  return (
    <>
      <div className="flex flex-col gap-y-6 max-w-lg">
        <h2 className="text-2xl font-semibold lg:-mt-4 lg:-mb-2">My Account</h2>
        <div className="dark:bg-black/30 bg-white rounded-lg shadow-lg p-4 flex flex-col gap-y-6 max-w-lg">
          <div>
            <h3 className="font-bold mb-2 text-lg text-gray-900 dark:text-white">
              Connections
            </h3>
            <div className="flex flex-col gap-y-4 text-sm">
              <div className="flex flex-col gap-1">
                <label className="font-medium">Email</label>
                <input
                  type="text"
                  className="border border-gray-300 rounded-md py-1 px-2 w-full max-w-xs"
                  value={userQuery.data?.email ?? ''}
                  disabled
                />
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-bold mb-2 text-lg text-gray-900 dark:text-white">
              Preferences
            </h3>
            {canDisableAds ? (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-blue-600 my-1"
                    checked={adsDisabled}
                    onChange={handleToggleAds}
                    disabled={userQuery.isLoading}
                    aria-label="Disable Ads"
                  />
                  <div>
                    <div className="font-medium">Disable Ads</div>
                    <div className="text-sm opacity-70">
                      Hide ads when you are signed in
                    </div>
                  </div>
                </label>
              </div>
            ) : null}
          </div>
          <div className="">
            <button
              onClick={signOut}
              className="text-sm flex gap-2 items-center font-medium bg-black/80 hover:bg-black text-white dark:bg-white/95 dark:hover:bg-white dark:text-black py-1.5 px-2 rounded-md transition-colors my-4"
            >
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </div>

        {/* LLM Keys Section */}
        <div className="dark:bg-black/30 bg-white rounded-lg shadow-lg p-4 flex flex-col gap-y-6 max-w-lg">
          <LLMKeysSection />
        </div>
      </div>
    </>
  )
}

function AccountPage() {
  return (
    <div className="min-h-screen mx-auto p-4 md:p-8 w-full">
      <Authenticated>
        <UserSettings />
      </Authenticated>
      <Unauthenticated>
        <div className="bg-white dark:bg-black/30 rounded-lg shadow-lg p-8 text-center w-[100vw] max-w-sm mx-auto">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Sign In Required
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            Please sign in to access your account settings.
          </p>
          <Link to="/login">
            <button className="text-sm font-medium bg-black/80 hover:bg-black text-white dark:text-black dark:bg-white/95 dark:hover:bg-white  py-2 px-4 rounded-md transition-colors">
              Sign In
            </button>
          </Link>
        </div>
      </Unauthenticated>
    </div>
  )
}
