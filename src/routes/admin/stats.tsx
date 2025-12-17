import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  FaUsers,
  FaEyeSlash,
  FaListUl,
  FaMinus,
} from 'react-icons/fa'
import { getUserStats } from '~/utils/user-stats.server'
import * as Plot from '@observablehq/plot'
import { useEffect, useRef } from 'react'
import { ArrowDown, ArrowUp, ChartLine } from 'lucide-react'

export const Route = createFileRoute('/admin/stats')({
  component: AdminStatsPage,
})

function AdminStatsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'user-stats'],
    queryFn: () => getUserStats(),
  })

  if (isLoading || !stats) {
    return (
      <div className="w-full p-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Admin Statistics
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Loading statistics...
            </p>
          </div>
          <div className="text-center py-12">
            <div className="text-gray-600 dark:text-gray-400">
              Loading statistics...
            </div>
          </div>
        </div>
      </div>
    )
  }

  const todayVsYesterday =
    stats.yesterdaySignups === 0
      ? 0
      : ((stats.todaySignups - stats.yesterdaySignups) /
          stats.yesterdaySignups) *
        100

  return (
    <div className="w-full p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <ChartLine className="text-2xl text-blue-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Admin Statistics
            </h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Overview of user signups, trends, and ads-related metrics
          </p>
        </div>

        {/* User Statistics Section */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FaUsers className="text-blue-500" />
            User Statistics
          </h2>

          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* Total Users */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl shadow-lg border border-blue-200 dark:border-blue-800 p-6">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Total Users
              </div>
              <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {stats.totalUsers.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                All-time registrations
              </div>
            </div>

            {/* Today's Signups */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Today's Signups
              </div>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {stats.todaySignups}
                </div>
                {todayVsYesterday !== 0 && (
                  <div
                    className={`flex items-center gap-1 text-sm font-medium ${
                      todayVsYesterday > 0
                        ? 'text-green-600 dark:text-green-400'
                        : todayVsYesterday < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {todayVsYesterday > 0 ? (
                      <ArrowUp />
                    ) : todayVsYesterday < 0 ? (
                      <ArrowDown />
                    ) : (
                      <FaMinus />
                    )}
                    {Math.abs(todayVsYesterday).toFixed(0)}%
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                vs yesterday ({stats.yesterdaySignups})
              </div>
            </div>

            {/* Average Per Day */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Avg Per Day
              </div>
              <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {stats.avgSignupsPerDay}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Last 30 days average
              </div>
            </div>

            {/* Last 7 Days */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Last 7 Days
              </div>
              <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {Object.values(stats.dailySignups).reduce(
                  (sum, count) => sum + count,
                  0,
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Total signups this week
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Signups Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Daily Signups
              </h3>
              <DailySignupsChart data={stats.signupsPerDay} />
            </div>

            {/* Cumulative Signups Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Cumulative User Signups Over Time
              </h3>
              <CumulativeSignupsChart data={stats.signupsPerDay} />
            </div>
          </div>
        </section>

        {/* Ads Statistics Section */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FaEyeSlash className="text-purple-500" />
            Ads-Related Statistics
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ads Hiding Waitlist Card */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl shadow-lg border border-purple-200 dark:border-purple-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <FaListUl className="text-2xl text-purple-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Ads Hiding Waitlist
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Total on Waitlist
                  </div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats.ads.waitlistCount.toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Waitlist with Ads Disabled
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.ads.waitlistWithAdsDisabledCount.toLocaleString()}
                    </div>
                    <div className="text-sm font-medium text-purple-600 dark:text-purple-400">
                      {stats.ads.waitlistConversionRate}% conversion
                    </div>
                  </div>
                </div>

                {stats.ads.waitlistCount > 0 && (
                  <div className="pt-4 border-t border-purple-200 dark:border-purple-700">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Waitlist Status
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-purple-600 dark:bg-purple-700 h-2 rounded-full"></div>
                      <div className="flex-1 bg-gray-200 dark:bg-gray-600 h-2 rounded-full"></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
                      <span>
                        Active: {stats.ads.waitlistWithAdsDisabledCount}
                      </span>
                      <span>
                        Waiting:{' '}
                        {stats.ads.waitlistCount -
                          stats.ads.waitlistWithAdsDisabledCount}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Ads Disabled Capability Card */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl shadow-lg border border-green-200 dark:border-green-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <FaEyeSlash className="text-2xl text-green-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Ads Disabled Status
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Users with Ads Disabled
                  </div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats.ads.disabledCount.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {(
                      (stats.ads.disabledCount / stats.totalUsers) *
                      100
                    ).toFixed(1)}
                    % of total users
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Users with DisableAds Capability
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.ads.capabilityCount.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Capability granted via roles/direct
                  </div>
                </div>

                <div className="pt-4 border-t border-green-200 dark:border-green-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Coverage
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-green-600 dark:bg-green-700 h-2 rounded-full"
                      style={{
                        width: `${Math.min(
                          (stats.ads.disabledCount / stats.totalUsers) * 100,
                          100,
                        )}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function DailySignupsChart({
  data,
}: {
  data: Array<{ date: string; count: number }>
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return

    const container = containerRef.current

    const renderChart = () => {
      if (!container) return

      // Clear previous chart
      container.innerHTML = ''

      // Create the plot
      const plot = Plot.plot({
        width: container.clientWidth,
        height: 400,
        marginLeft: 60,
        marginRight: 20,
        marginTop: 20,
        marginBottom: 40,
        x: {
          label: 'Date',
          type: 'utc',
          grid: true,
        },
        y: {
          label: 'Daily Signups',
          grid: true,
        },
        marks: [
          // Use rectY instead of barY for continuous time scale
          Plot.rectY(data, {
            x: (d) => new Date(d.date),
            y: 'count',
            fill: '#10b981',
            fillOpacity: 0.8,
            interval: 'day', // One bar per day
          }),
          // Hover tip
          Plot.tip(
            data,
            Plot.pointerX({
              x: (d) => new Date(d.date),
              y: 'count',
              title: (d) => `${d.date}\n${d.count.toLocaleString()} signups`,
            }),
          ),
        ],
        style: {
          background: 'transparent',
          fontSize: '12px',
        },
      })

      container.appendChild(plot)
    }

    // Initial render
    renderChart()

    // Set up ResizeObserver for responsive resizing
    const resizeObserver = new ResizeObserver(() => {
      renderChart()
    })

    resizeObserver.observe(container)

    // Cleanup
    return () => {
      resizeObserver.disconnect()
      container.innerHTML = ''
    }
  }, [data])

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-600 dark:text-gray-400">
        No signup data available yet
      </div>
    )
  }

  return <div ref={containerRef} className="w-full" />
}

function CumulativeSignupsChart({
  data,
}: {
  data: Array<{ date: string; count: number }>
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return

    const container = containerRef.current

    const renderChart = () => {
      if (!container) return

      // Clear previous chart
      container.innerHTML = ''

      // Use Plot's map transform to compute cumulative sum
      const plot = Plot.plot({
        width: container.clientWidth,
        height: 400,
        marginLeft: 60,
        marginRight: 20,
        marginTop: 20,
        marginBottom: 40,
        x: {
          label: 'Date',
          type: 'utc',
          grid: true,
        },
        y: {
          label: 'Total Users',
          grid: true,
        },
        marks: [
          // Area fill with cumulative sum
          Plot.areaY(
            data,
            Plot.mapY(
              'cumsum', // Observable Plot's cumulative sum transform
              {
                x: (d) => new Date(d.date),
                y: 'count',
                fill: '#3b82f6',
                fillOpacity: 0.2,
                curve: 'monotone-x',
              },
            ),
          ),
          // Line with cumulative sum
          Plot.lineY(
            data,
            Plot.mapY(
              'cumsum', // Observable Plot's cumulative sum transform
              {
                x: (d) => new Date(d.date),
                y: 'count',
                stroke: '#3b82f6',
                strokeWidth: 2,
                curve: 'monotone-x',
              },
            ),
          ),
          // Points with cumulative sum
          Plot.dot(
            data,
            Plot.mapY(
              'cumsum', // Observable Plot's cumulative sum transform
              {
                x: (d) => new Date(d.date),
                y: 'count',
                fill: '#3b82f6',
                r: 3,
              },
            ),
          ),
          // Hover tip with cumulative sum
          Plot.tip(
            data,
            Plot.pointerX(
              Plot.mapY(
                'cumsum', // Observable Plot's cumulative sum transform
                {
                  x: (d) => new Date(d.date),
                  y: 'count',
                  title: (d, i) => {
                    // Calculate cumulative count for tooltip
                    let cumSum = 0
                    for (let j = 0; j <= i; j++) {
                      cumSum += data[j].count
                    }
                    return `${d.date}\n${cumSum.toLocaleString()} total users`
                  },
                },
              ),
            ),
          ),
        ],
        style: {
          background: 'transparent',
          fontSize: '12px',
        },
      })

      container.appendChild(plot)
    }

    // Initial render
    renderChart()

    // Set up ResizeObserver for responsive resizing
    const resizeObserver = new ResizeObserver(() => {
      renderChart()
    })

    resizeObserver.observe(container)

    // Cleanup
    return () => {
      resizeObserver.disconnect()
      container.innerHTML = ''
    }
  }, [data])

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-600 dark:text-gray-400">
        No signup data available yet
      </div>
    )
  }

  return <div ref={containerRef} className="w-full" />
}
