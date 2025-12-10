import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { getFeedStatsQueryOptions } from '~/queries/feed'
import {
  syncAllFeedSources,
  syncGitHubSource,
  syncBlogSource,
} from '~/utils/admin'
import { FaSync, FaSpinner } from 'react-icons/fa'

export function FeedSyncStatus({
  onSyncComplete,
}: {
  onSyncComplete?: () => void
} = {}) {
  const statsQuery = useQuery(getFeedStatsQueryOptions())
  const [syncingAll, setSyncingAll] = React.useState(false)
  const [syncingSources, setSyncingSources] = React.useState<
    Record<string, boolean>
  >({})

  const handleSyncAll = async () => {
    setSyncingAll(true)
    try {
      await syncAllFeedSources()
      statsQuery.refetch()
      onSyncComplete?.()
    } catch (error) {
      console.error('Error syncing all sources:', error)
      alert('Failed to sync all sources. Please check console for details.')
    } finally {
      setSyncingAll(false)
    }
  }

  const handleSyncSource = async (source: string) => {
    setSyncingSources((prev) => ({ ...prev, [source]: true }))
    try {
      if (source === 'github') {
        await syncGitHubSource()
      } else if (source === 'blog') {
        await syncBlogSource()
      }
      statsQuery.refetch()
      onSyncComplete?.()
    } catch (error) {
      console.error(`Error syncing ${source}:`, error)
      alert(`Failed to sync ${source}. Please check console for details.`)
    } finally {
      setSyncingSources((prev) => ({ ...prev, [source]: false }))
    }
  }

  if (statsQuery.isLoading) {
    return <div>Loading stats...</div>
  }

  const stats = statsQuery.data

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">Sync Status</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAll}
            disabled={syncingAll || Object.values(syncingSources).some(Boolean)}
            className="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            {syncingAll ? (
              <FaSpinner className="animate-spin w-3 h-3" />
            ) : (
              <FaSync className="w-3 h-3" />
            )}
            Sync All
          </button>
        </div>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <div className="text-center">
              <div className="text-base font-bold">{stats.total}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Total
              </div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold">{stats.visible}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Visible
              </div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold">{stats.featured}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Featured
              </div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold">
                {Object.keys(stats.bySource).length}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Sources
              </div>
            </div>
          </div>

          {/* By Source Breakdown */}
          <div className="mb-3">
            <h3 className="text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
              By Source
            </h3>
            <div className="space-y-1">
              {Object.entries(stats.bySource).map(([source, count]) => {
                const isSyncing = syncingSources[source] || false
                return (
                  <div
                    key={source}
                    className="flex items-center justify-between px-2 py-1 bg-gray-50 dark:bg-gray-700 rounded text-xs"
                  >
                    <span className="capitalize">{source}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{count}</span>
                      <button
                        onClick={() => handleSyncSource(source)}
                        disabled={
                          syncingAll ||
                          isSyncing ||
                          Object.values(syncingSources).some(Boolean)
                        }
                        className="p-0.5 text-gray-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title={`Sync ${source}`}
                      >
                        {isSyncing ? (
                          <FaSpinner className="animate-spin w-2.5 h-2.5" />
                        ) : (
                          <FaSync className="w-2.5 h-2.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* By Category Breakdown */}
          <div>
            <h3 className="text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
              By Category
            </h3>
            <div className="space-y-1">
              {Object.entries(stats.byCategory).map(([category, count]) => (
                <div
                  key={category}
                  className="flex items-center justify-between px-2 py-1 bg-gray-50 dark:bg-gray-700 rounded text-xs"
                >
                  <span className="capitalize">{category}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
