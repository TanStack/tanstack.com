import * as React from 'react'
import { useQuery as useConvexQuery, useAction } from 'convex/react'
import { api } from 'convex/_generated/api'
import { FaSync, FaSpinner } from 'react-icons/fa'

export function FeedSyncStatus() {
  const statsQuery = useConvexQuery(api.feed.queries.getFeedStats)
  // Note: Actions need to be exported from convex/feed/actions.ts
  // For now, sync functions should be called via mutations or HTTP endpoints
  // TODO: Fix action exports in Convex
  const syncGitHub = useAction(api.feed.github.syncGitHubReleases)
  const [syncing, setSyncing] = React.useState(false)

  const handleSyncGitHub = async () => {
    setSyncing(true)
    try {
      // Call without daysBack - function defaults to 30 days for initial sync
      // Once Convex syncs, we can pass { daysBack: 30 } explicitly
      await syncGitHub({})
    } catch (error) {
      console.error('Error syncing GitHub:', error)
      alert('Failed to sync GitHub releases. Please check console for details.')
    } finally {
      setSyncing(false)
    }
  }

  if (!statsQuery) {
    return <div>Loading stats...</div>
  }

  const stats = statsQuery

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Sync Status</h2>
        <div className="flex gap-2">
          <button
            onClick={handleSyncGitHub}
            disabled={syncing}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {syncing ? <FaSpinner className="animate-spin" /> : <FaSync />}
            Sync GitHub
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Total Entries
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{stats.visible}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Visible
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{stats.featured}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Featured
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">
            {Object.keys(stats.bySource).length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Sources
          </div>
        </div>
      </div>

      {/* By Source Breakdown */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3">Entries by Source</h3>
        <div className="space-y-2">
          {Object.entries(stats.bySource).map(([source, count]) => (
            <div
              key={source}
              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
            >
              <span className="capitalize">{source}</span>
              <span className="font-bold">{count as number}</span>
            </div>
          ))}
        </div>
      </div>

      {/* By Category Breakdown */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3">Entries by Category</h3>
        <div className="space-y-2">
          {Object.entries(stats.byCategory).map(([category, count]) => (
            <div
              key={category}
              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
            >
              <span className="capitalize">{category}</span>
              <span className="font-bold">{count as number}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
