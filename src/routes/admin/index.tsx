import { useSearch, Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useCapabilities } from '~/hooks/useCapabilities'
import { hasCapability } from '~/db/types'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { getUserStats, getSignupsChartData } from '~/utils/user-stats.server'
import { getActivityStats, getLoginsChartData } from '~/utils/audit.functions'
import {
  getActivityStatsAdmin,
  getDauChartData,
} from '~/utils/activity.functions'
import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChartLine,
  EyeOff,
  Flame,
  LayoutDashboard,
  List,
  Lock,
  LogIn,
  Minus,
  Shield,
  Trophy,
  Users,
} from 'lucide-react'
import { Card } from '~/components/Card'
import { Badge, Button } from '~/ui'
import * as v from 'valibot'
import { TimeSeriesChart } from '~/components/charts/TimeSeriesChart'
import { ChartControls } from '~/components/charts/ChartControls'
import {
  type TimeRange,
  type BinType,
  timeRangeToDays,
  defaultBinForRange,
} from '~/utils/chart'

const searchSchema = v.object({
  tab: v.optional(
    v.picklist(['overview', 'users', 'activity', 'ads']),
    'overview',
  ),
})

export const Route = createFileRoute('/admin/')({
  validateSearch: searchSchema,
  component: AdminPage,
})

function AdminPage() {
  const userQuery = useCurrentUserQuery()
  const user = userQuery.data
  const capabilities = useCapabilities()

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  const canAdmin = hasCapability(capabilities, 'admin')
  if (user && !canAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Lock className="text-4xl text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don't have permission to access the admin area.
          </p>
          <Link to="/">
            <Button>Back to Home</Button>
          </Link>
        </div>
      </div>
    )
  }

  return <AdminDashboard />
}

function AdminDashboard() {
  const { tab } = useSearch({ from: '/admin/' })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'user-stats'],
    queryFn: () => getUserStats(),
    staleTime: 0,
  })

  const { data: activityStats, isLoading: activityLoading } = useQuery({
    queryKey: ['admin', 'activity-stats'],
    queryFn: () => getActivityStats(),
    staleTime: 0,
  })

  const { data: dauStats, isLoading: dauLoading } = useQuery({
    queryKey: ['admin', 'dau-stats'],
    queryFn: () => getActivityStatsAdmin(),
    staleTime: 0,
  })

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard /> },
    { id: 'users', label: 'Users', icon: <Users /> },
    { id: 'activity', label: 'Activity', icon: <LogIn /> },
    { id: 'ads', label: 'Ads', icon: <EyeOff /> },
  ] as const

  return (
    <div className="w-full p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <ChartLine className="text-2xl text-blue-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Overview of user signups, activity, and platform metrics
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {tabs.map((t) => (
              <Link
                key={t.id}
                to="/admin"
                search={{ tab: t.id }}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {t.icon}
                {t.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {tab === 'overview' && (
          <OverviewTab
            stats={stats}
            activityStats={activityStats}
            dauStats={dauStats}
            isLoading={statsLoading || activityLoading || dauLoading}
          />
        )}
        {tab === 'users' && <UsersTab stats={stats} isLoading={statsLoading} />}
        {tab === 'activity' && (
          <ActivityTab
            activityStats={activityStats}
            dauStats={dauStats}
            isLoading={activityLoading || dauLoading}
          />
        )}
        {tab === 'ads' && <AdsTab stats={stats} isLoading={statsLoading} />}
      </div>
    </div>
  )
}

// Types
type UserStats = Awaited<ReturnType<typeof getUserStats>>
type ActivityStats = Awaited<ReturnType<typeof getActivityStats>>
type DauStats = Awaited<ReturnType<typeof getActivityStatsAdmin>>

// Overview Tab - Summary with one chart from each category
function OverviewTab({
  stats,
  activityStats,
  dauStats,
  isLoading,
}: {
  stats: UserStats | undefined
  activityStats: ActivityStats | undefined
  dauStats: DauStats | undefined
  isLoading: boolean
}) {
  if (isLoading || !stats) {
    return <LoadingState />
  }

  const todayVsYesterday =
    stats.yesterdaySignups === 0
      ? 0
      : ((stats.todaySignups - stats.yesterdaySignups) /
          stats.yesterdaySignups) *
        100

  return (
    <div className="space-y-6">
      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800 p-4">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Total Users
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.totalUsers.toLocaleString()}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Today's Signups
          </div>
          <div className="flex items-center gap-2">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.todaySignups}
            </div>
            {todayVsYesterday !== 0 && (
              <ChangeIndicator value={todayVsYesterday} />
            )}
          </div>
        </Card>

        {dauStats && (
          <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800 p-4">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              DAU
            </div>
            <div className="flex items-center gap-2">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {dauStats.dau}
              </div>
              {dauStats.dauYesterday > 0 && (
                <ChangeIndicator
                  value={
                    ((dauStats.dau - dauStats.dauYesterday) /
                      dauStats.dauYesterday) *
                    100
                  }
                />
              )}
            </div>
          </Card>
        )}

        <Card className="p-4">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Ads Disabled
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.ads.disabledCount.toLocaleString()}
          </div>
        </Card>
      </div>

      {/* Overview Charts - One from each category */}
      {/* Overview Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SignupsChartCard
          title="User Signups"
          variant="cumulative"
          defaultTimeRange="all-time"
          color="#3b82f6"
          height={200}
        />
        <DauChartCard title="Daily Active Users" height={200} />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Summary */}
        {activityStats && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <LogIn className="text-cyan-500" />
              Login Activity
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Today
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {activityStats.logins.today}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  7 Days
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {activityStats.activeUsers.last7Days}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  30 Days
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {activityStats.activeUsers.last30Days}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Streak Leaderboard Preview */}
        {dauStats && dauStats.streakLeaderboard.length > 0 && (
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Trophy className="text-amber-500" />
                Top Streaks
              </h3>
              <Link
                to="/admin"
                search={{ tab: 'activity' }}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                View all →
              </Link>
            </div>
            <div className="space-y-2">
              {dauStats.streakLeaderboard.slice(0, 3).map((user, index) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-bold w-5 ${
                        index === 0
                          ? 'text-amber-500'
                          : index === 1
                            ? 'text-gray-400'
                            : 'text-amber-700'
                      }`}
                    >
                      #{index + 1}
                    </span>
                    {user.userImage ? (
                      <img
                        className="h-6 w-6 rounded-full"
                        src={user.userImage}
                        alt=""
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-gray-300 dark:bg-gray-600" />
                    )}
                    <span className="text-sm text-gray-900 dark:text-white truncate max-w-[120px]">
                      {user.userName || user.userEmail || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-bold">
                    <Flame className="w-4 h-4" />
                    {user.currentStreak}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

// Users Tab - Full user statistics
function UsersTab({
  stats,
  isLoading,
}: {
  stats: UserStats | undefined
  isLoading: boolean
}) {
  if (isLoading || !stats) {
    return <LoadingState />
  }

  const todayVsYesterday =
    stats.yesterdaySignups === 0
      ? 0
      : ((stats.todaySignups - stats.yesterdaySignups) /
          stats.yesterdaySignups) *
        100

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

        <Card className="p-6">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            Today's Signups
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="text-4xl font-bold text-gray-900 dark:text-white">
              {stats.todaySignups}
            </div>
            {todayVsYesterday !== 0 && (
              <ChangeIndicator value={todayVsYesterday} />
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            vs yesterday ({stats.yesterdaySignups})
          </div>
        </Card>

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
        <SignupsChartCard
          title="Daily Signups"
          variant="bar"
          defaultTimeRange="90-days"
          color="#10b981"
          height={300}
        />
        <SignupsChartCard
          title="Cumulative User Signups"
          variant="cumulative"
          defaultTimeRange="all-time"
          color="#3b82f6"
          height={300}
        />
      </div>

      {/* User Management Link */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              User Management
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              View and manage individual user accounts, roles, and capabilities.
            </p>
          </div>
          <Link to="/admin/users">
            <Button>Manage Users</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}

// Activity Tab - Logins, DAU, streaks
function ActivityTab({
  activityStats,
  dauStats,
  isLoading,
}: {
  activityStats: ActivityStats | undefined
  dauStats: DauStats | undefined
  isLoading: boolean
}) {
  if (isLoading) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      {/* DAU/WAU/MAU Cards */}
      {dauStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800 p-6">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              DAU (Today)
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="text-4xl font-bold text-gray-900 dark:text-white">
                {dauStats.dau}
              </div>
              {dauStats.dauYesterday > 0 && (
                <ChangeIndicator
                  value={
                    ((dauStats.dau - dauStats.dauYesterday) /
                      dauStats.dauYesterday) *
                    100
                  }
                />
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              vs yesterday ({dauStats.dauYesterday})
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              WAU (7 days)
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="text-4xl font-bold text-gray-900 dark:text-white">
                {dauStats.wau}
              </div>
              {dauStats.wauPrevious > 0 && (
                <ChangeIndicator
                  value={
                    ((dauStats.wau - dauStats.wauPrevious) /
                      dauStats.wauPrevious) *
                    100
                  }
                />
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              vs previous 7 days ({dauStats.wauPrevious})
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              MAU (30 days)
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="text-4xl font-bold text-gray-900 dark:text-white">
                {dauStats.mau}
              </div>
              {dauStats.mauPrevious > 0 && (
                <ChangeIndicator
                  value={
                    ((dauStats.mau - dauStats.mauPrevious) /
                      dauStats.mauPrevious) *
                    100
                  }
                />
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              vs previous 30 days ({dauStats.mauPrevious})
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              DAU/MAU Ratio
            </div>
            <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              {dauStats.mau > 0
                ? Math.round((dauStats.dau / dauStats.mau) * 100)
                : 0}
              %
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Stickiness metric
            </div>
          </Card>
        </div>
      )}

      {/* Login Stats */}
      {activityStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border-cyan-200 dark:border-cyan-800 p-6">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              Today's Logins
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="text-4xl font-bold text-gray-900 dark:text-white">
                {activityStats.logins.today}
              </div>
              {activityStats.logins.yesterday > 0 && (
                <ChangeIndicator
                  value={
                    ((activityStats.logins.today -
                      activityStats.logins.yesterday) /
                      activityStats.logins.yesterday) *
                    100
                  }
                />
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              vs yesterday ({activityStats.logins.yesterday})
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              Active Users Today
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="text-4xl font-bold text-gray-900 dark:text-white">
                {activityStats.activeUsers.today}
              </div>
              {activityStats.activeUsers.yesterday > 0 && (
                <ChangeIndicator
                  value={
                    ((activityStats.activeUsers.today -
                      activityStats.activeUsers.yesterday) /
                      activityStats.activeUsers.yesterday) *
                    100
                  }
                />
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              vs yesterday ({activityStats.activeUsers.yesterday})
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              Active Users (7d)
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="text-4xl font-bold text-gray-900 dark:text-white">
                {activityStats.activeUsers.last7Days}
              </div>
              {activityStats.activeUsers.previous7Days > 0 && (
                <ChangeIndicator
                  value={
                    ((activityStats.activeUsers.last7Days -
                      activityStats.activeUsers.previous7Days) /
                      activityStats.activeUsers.previous7Days) *
                    100
                  }
                />
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              vs previous 7 days ({activityStats.activeUsers.previous7Days})
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              Active Users (30d)
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="text-4xl font-bold text-gray-900 dark:text-white">
                {activityStats.activeUsers.last30Days}
              </div>
              {activityStats.activeUsers.previous30Days > 0 && (
                <ChangeIndicator
                  value={
                    ((activityStats.activeUsers.last30Days -
                      activityStats.activeUsers.previous30Days) /
                      activityStats.activeUsers.previous30Days) *
                    100
                  }
                />
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              vs previous 30 days ({activityStats.activeUsers.previous30Days})
            </div>
          </Card>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DauChartCard title="Daily Active Users" />
        <LoginsChartCard title="Daily Logins" />
      </div>

      {/* Login Providers & Top Users */}
      {activityStats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    <Badge variant={provider === 'github' ? 'default' : 'info'}>
                      {provider}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        {count.toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        (
                        {Math.round((count / activityStats.logins.total) * 100)}
                        %)
                      </span>
                    </div>
                  </div>
                ),
              )}
              {Object.keys(activityStats.providerBreakdown).length === 0 && (
                <div className="text-center text-gray-500 dark:text-gray-400">
                  No login data yet
                </div>
              )}
            </div>
          </Card>

          {/* Top Users by Logins */}
          {activityStats.topUsersByLogins.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Most Active Users (30 days)
              </h3>
              <div className="space-y-3">
                {activityStats.topUsersByLogins
                  .slice(0, 5)
                  .map((user, index) => (
                    <div
                      key={user.userId}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-6">
                          #{index + 1}
                        </span>
                        <div className="flex-shrink-0 h-8 w-8">
                          {user.userImage ? (
                            <img
                              className="h-8 w-8 rounded-full"
                              src={user.userImage}
                              alt=""
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                              <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[150px]">
                          {user.userName || user.userEmail || 'Unknown'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-900 dark:text-white">
                          {user.count}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Streak Leaderboard */}
      {dauStats && dauStats.streakLeaderboard.length > 0 && (
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="text-2xl text-amber-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Streak Leaderboard
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dauStats.streakLeaderboard.map((user, index) => (
              <div
                key={user.userId}
                className="flex items-center justify-between p-3 bg-white/50 dark:bg-black/20 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-bold w-6 ${
                      index === 0
                        ? 'text-amber-500'
                        : index === 1
                          ? 'text-gray-400'
                          : index === 2
                            ? 'text-amber-700'
                            : 'text-gray-500'
                    }`}
                  >
                    #{index + 1}
                  </span>
                  <div className="flex-shrink-0 h-8 w-8">
                    {user.userImage ? (
                      <img
                        className="h-8 w-8 rounded-full"
                        src={user.userImage}
                        alt=""
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                        <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {user.userName || user.userEmail || 'Unknown'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {user.totalActiveDays} total days
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-lg font-bold text-orange-600 dark:text-orange-400">
                    <Flame className="w-4 h-4" />
                    {user.currentStreak}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    best: {user.longestStreak}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Admin Activity */}
      {activityStats && (
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
      )}
    </div>
  )
}

// Ads Tab
function AdsTab({
  stats,
  isLoading,
}: {
  stats: UserStats | undefined
  isLoading: boolean
}) {
  if (isLoading || !stats) {
    return <LoadingState />
  }

  const waitlistPercentage = (
    (stats.ads.waitlistCount / stats.totalUsers) *
    100
  ).toFixed(1)

  return (
    <div className="space-y-6">
      {/* Waitlist Demand - Primary Focus */}
      <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <List className="text-2xl text-purple-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Ad-Free Waitlist Demand
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Users on Waitlist
            </div>
            <div className="text-4xl font-bold text-gray-900 dark:text-white">
              {stats.ads.waitlistCount.toLocaleString()}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              % of Total Users
            </div>
            <div className="text-4xl font-bold text-purple-600 dark:text-purple-400">
              {waitlistPercentage}%
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Total Users
            </div>
            <div className="text-4xl font-bold text-gray-900 dark:text-white">
              {stats.totalUsers.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-purple-200 dark:border-purple-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Waitlist Demand
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-600 h-3 rounded-full overflow-hidden">
            <div
              className="bg-purple-600 dark:bg-purple-500 h-3 rounded-full transition-all"
              style={{
                width: `${Math.min(parseFloat(waitlistPercentage), 100)}%`,
              }}
            />
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            {stats.ads.waitlistCount.toLocaleString()} of{' '}
            {stats.totalUsers.toLocaleString()} users interested in hiding ads
          </div>
        </div>
      </Card>

      {/* Current Ads Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <EyeOff className="text-2xl text-green-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Users with Ads Disabled
            </h3>
          </div>

          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
            {stats.ads.disabledCount.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {((stats.ads.disabledCount / stats.totalUsers) * 100).toFixed(1)}%
            of total users
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="w-full bg-gray-200 dark:bg-gray-600 h-2 rounded-full overflow-hidden">
              <div
                className="bg-green-600 dark:bg-green-700 h-2 rounded-full"
                style={{
                  width: `${Math.min(
                    (stats.ads.disabledCount / stats.totalUsers) * 100,
                    100,
                  )}%`,
                }}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="text-2xl text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              DisableAds Capability
            </h3>
          </div>

          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
            {stats.ads.capabilityCount.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Users with capability granted via roles
          </div>
        </Card>
      </div>
    </div>
  )
}

// Helper Components
function LoadingState() {
  return (
    <div className="text-center py-12">
      <div className="text-gray-600 dark:text-gray-400">Loading...</div>
    </div>
  )
}

function ChangeIndicator({ value }: { value: number }) {
  const isPositive = value > 0
  const isNegative = value < 0

  return (
    <div
      className={`flex items-center gap-1 text-sm font-medium ${
        isPositive
          ? 'text-green-600 dark:text-green-400'
          : isNegative
            ? 'text-red-600 dark:text-red-400'
            : 'text-gray-600 dark:text-gray-400'
      }`}
    >
      {isPositive ? (
        <ArrowUp className="w-4 h-4" />
      ) : isNegative ? (
        <ArrowDown className="w-4 h-4" />
      ) : (
        <Minus className="w-4 h-4" />
      )}
      {Math.abs(value).toFixed(0)}%
    </div>
  )
}

// Chart Card Components with Time Range Controls

function SignupsChartCard({
  title,
  variant = 'bar',
  defaultTimeRange = '30-days',
  color = '#10b981',
  height = 200,
  linkTo,
}: {
  title: string
  variant?: 'bar' | 'area' | 'cumulative'
  defaultTimeRange?: TimeRange
  color?: string
  height?: number
  linkTo?: string
}) {
  const [timeRange, setTimeRange] = useState<TimeRange>(defaultTimeRange)
  const [binType, setBinType] = useState<BinType>(
    defaultBinForRange[defaultTimeRange],
  )

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'signups-chart', timeRange],
    queryFn: () =>
      getSignupsChartData({ data: { days: timeRangeToDays(timeRange) } }),
  })

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="text-blue-500" />
          {title}
        </h3>
        <div className="flex items-center gap-2">
          <ChartControls
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            binType={binType}
            onBinTypeChange={setBinType}
          />
          {linkTo && (
            <Link
              to={linkTo}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Details
            </Link>
          )}
        </div>
      </div>
      {isLoading ? (
        <div className="h-[200px] flex items-center justify-center text-gray-500">
          Loading...
        </div>
      ) : (
        <TimeSeriesChart
          data={data ?? []}
          binType={binType}
          variant={variant}
          color={color}
          height={height}
          yLabel={variant === 'cumulative' ? 'Total Users' : 'Signups'}
        />
      )}
    </Card>
  )
}

function DauChartCard({
  title,
  defaultTimeRange = '30-days',
  height = 200,
  linkTo,
}: {
  title: string
  defaultTimeRange?: TimeRange
  height?: number
  linkTo?: string
}) {
  const [timeRange, setTimeRange] = useState<TimeRange>(defaultTimeRange)
  const [binType, setBinType] = useState<BinType>(
    defaultBinForRange[defaultTimeRange],
  )

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dau-chart', timeRange],
    queryFn: () =>
      getDauChartData({ data: { days: timeRangeToDays(timeRange) } }),
  })

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Flame className="text-orange-500" />
          {title}
        </h3>
        <div className="flex items-center gap-2">
          <ChartControls
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            binType={binType}
            onBinTypeChange={setBinType}
          />
          {linkTo && (
            <Link
              to={linkTo}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Details
            </Link>
          )}
        </div>
      </div>
      {isLoading ? (
        <div className="h-[200px] flex items-center justify-center text-gray-500">
          Loading...
        </div>
      ) : (
        <TimeSeriesChart
          data={data ?? []}
          binType={binType}
          variant="area"
          color="#10b981"
          height={height}
          yLabel="Active Users"
        />
      )}
    </Card>
  )
}

function LoginsChartCard({
  title,
  defaultTimeRange = '30-days',
  height = 200,
}: {
  title: string
  defaultTimeRange?: TimeRange
  height?: number
}) {
  const [timeRange, setTimeRange] = useState<TimeRange>(defaultTimeRange)
  const [binType, setBinType] = useState<BinType>(
    defaultBinForRange[defaultTimeRange],
  )

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'logins-chart', timeRange],
    queryFn: () =>
      getLoginsChartData({ data: { days: timeRangeToDays(timeRange) } }),
  })

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <LogIn className="text-cyan-500" />
          {title}
        </h3>
        <ChartControls
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          binType={binType}
          onBinTypeChange={setBinType}
        />
      </div>
      {isLoading ? (
        <div className="h-[200px] flex items-center justify-center text-gray-500">
          Loading...
        </div>
      ) : (
        <TimeSeriesChart
          data={data ?? []}
          binType={binType}
          variant="bar"
          color="#06b6d4"
          height={height}
          yLabel="Logins"
        />
      )}
    </Card>
  )
}
