import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getUserStats } from '~/utils/user-stats.server'
import { getActivityStats } from '~/utils/audit.functions'
import * as Plot from '@observablehq/plot'
import { useEffect, useRef } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChartLine,
  EyeOff,
  List,
  LogIn,
  Minus,
  Shield,
  Users,
} from 'lucide-react'
import { Card } from '~/components/Card'

export const Route = createFileRoute('/admin/stats')({
  component: AdminStatsPage,
})

function AdminStatsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'user-stats'],
    queryFn: () => getUserStats(),
  })

  const { data: activityStats, isLoading: activityLoading } = useQuery({
    queryKey: ['admin', 'activity-stats'],
    queryFn: () => getActivityStats(),
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
            <Users className="text-blue-500 text-xl" />
            User Statistics
          </h2>

          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* Total Users */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800 p-6">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Total Users
              </div>
              <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {stats.totalUsers.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                All-time registrations
              </div>
            </Card>

            {/* Today's Signups */}
            <Card className="p-6">
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
                      <Minus />
                    )}
                    {Math.abs(todayVsYesterday).toFixed(0)}%
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                vs yesterday ({stats.yesterdaySignups})
              </div>
            </Card>

            {/* Average Per Day */}
            <Card className="p-6">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Avg Per Day
              </div>
              <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {stats.avgSignupsPerDay}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Last 30 days average
              </div>
            </Card>

            {/* Last 7 Days */}
            <Card className="p-6">
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
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Signups Chart */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Daily Signups
              </h3>
              <DailySignupsChart data={stats.signupsPerDay} />
            </Card>

            {/* Cumulative Signups Chart */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Cumulative User Signups Over Time
              </h3>
              <CumulativeSignupsChart data={stats.signupsPerDay} />
            </Card>
          </div>
        </section>

        {/* Ads Statistics Section */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <EyeOff className="text-purple-500" />
            Ads-Related Statistics
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ads Hiding Waitlist Card */}
            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <List className="text-2xl text-purple-500" />
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
            </Card>

            {/* Ads Disabled Capability Card */}
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <EyeOff className="text-2xl text-green-500" />
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
            </Card>
          </div>
        </section>

        {/* Activity Statistics Section */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <LogIn className="text-cyan-500" />
            User Activity
          </h2>

          {activityLoading || !activityStats ? (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              Loading activity stats...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                {/* Today's Logins */}
                <Card className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border-cyan-200 dark:border-cyan-800 p-6">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Today's Logins
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-4xl font-bold text-gray-900 dark:text-white">
                      {activityStats.logins.today}
                    </div>
                    {activityStats.logins.yesterday > 0 && (
                      <div
                        className={`flex items-center gap-1 text-sm font-medium ${
                          activityStats.logins.today >
                          activityStats.logins.yesterday
                            ? 'text-green-600 dark:text-green-400'
                            : activityStats.logins.today <
                                activityStats.logins.yesterday
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {activityStats.logins.today >
                        activityStats.logins.yesterday ? (
                          <ArrowUp className="w-4 h-4" />
                        ) : activityStats.logins.today <
                          activityStats.logins.yesterday ? (
                          <ArrowDown className="w-4 h-4" />
                        ) : (
                          <Minus className="w-4 h-4" />
                        )}
                        {Math.abs(
                          Math.round(
                            ((activityStats.logins.today -
                              activityStats.logins.yesterday) /
                              activityStats.logins.yesterday) *
                              100,
                          ),
                        )}
                        %
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    vs yesterday ({activityStats.logins.yesterday})
                  </div>
                </Card>

                {/* Active Users Today */}
                <Card className="p-6">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Active Users Today
                  </div>
                  <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                    {activityStats.activeUsers.today}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Unique users who logged in
                  </div>
                </Card>

                {/* Active Users (7 Days) */}
                <Card className="p-6">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Active Users (7d)
                  </div>
                  <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                    {activityStats.activeUsers.last7Days}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Last 7 days
                  </div>
                </Card>

                {/* Active Users (30 Days) */}
                <Card className="p-6">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Active Users (30d)
                  </div>
                  <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                    {activityStats.activeUsers.last30Days}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Last 30 days
                  </div>
                </Card>
              </div>

              {/* Login Provider Breakdown & Daily Logins Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Provider Breakdown */}
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Login Providers
                    </h3>
                    <Link
                      to="/admin/logins"
                      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      View all logins →
                    </Link>
                  </div>
                  <div className="space-y-4">
                    {Object.entries(activityStats.providerBreakdown).map(
                      ([provider, count]) => (
                        <div
                          key={provider}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                provider === 'github'
                                  ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                              }`}
                            >
                              {provider}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold text-gray-900 dark:text-white">
                              {count.toLocaleString()}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              (
                              {Math.round(
                                (count / activityStats.logins.total) * 100,
                              )}
                              %)
                            </span>
                          </div>
                        </div>
                      ),
                    )}
                    {Object.keys(activityStats.providerBreakdown).length ===
                      0 && (
                      <div className="text-center text-gray-500 dark:text-gray-400">
                        No login data yet
                      </div>
                    )}
                  </div>
                </Card>

                {/* Daily Logins Chart */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Daily Logins (30 days)
                  </h3>
                  <DailyLoginsChart data={activityStats.dailyLogins} />
                </Card>
              </div>

              {/* Audit Logs Summary */}
              <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Shield className="text-2xl text-orange-500" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Admin Activity
                    </h3>
                  </div>
                  <Link
                    to="/admin/audit"
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    View audit logs →
                  </Link>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Total Actions
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {activityStats.auditLogs.total.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Last 7 Days
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {activityStats.auditLogs.last7Days.toLocaleString()}
                    </div>
                  </div>
                </div>

                {Object.keys(activityStats.actionBreakdown).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-orange-200 dark:border-orange-700">
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                      Recent Actions (30 days)
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(activityStats.actionBreakdown)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([action, count]) => (
                          <span
                            key={action}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                          >
                            {action.split('.').slice(-1)[0]}: {count}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </Card>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function DailyLoginsChart({
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

      container.innerHTML = ''

      const plot = Plot.plot({
        width: container.clientWidth,
        height: 200,
        marginLeft: 50,
        marginRight: 20,
        marginTop: 20,
        marginBottom: 40,
        x: {
          label: 'Date',
          type: 'utc',
          grid: true,
        },
        y: {
          label: 'Logins',
          grid: true,
        },
        marks: [
          Plot.rectY(data, {
            x: (d) => new Date(d.date),
            y: 'count',
            fill: '#06b6d4',
            fillOpacity: 0.8,
            interval: 'day',
          }),
          Plot.tip(
            data,
            Plot.pointerX({
              x: (d) => new Date(d.date),
              y: 'count',
              title: (d) => `${d.date}\n${d.count.toLocaleString()} logins`,
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

    renderChart()

    const resizeObserver = new ResizeObserver(() => {
      renderChart()
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      container.innerHTML = ''
    }
  }, [data])

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600 dark:text-gray-400">
        No login data available yet
      </div>
    )
  }

  return <div ref={containerRef} className="w-full" />
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
