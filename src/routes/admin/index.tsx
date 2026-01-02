import { createFileRoute, useSearch, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useCapabilities } from '~/hooks/useCapabilities'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { getUserStats } from '~/utils/user-stats.server'
import { getActivityStats } from '~/utils/audit.functions'
import { getActivityStatsAdmin } from '~/utils/activity.functions'
import * as Plot from '@observablehq/plot'
import { useEffect, useRef } from 'react'
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
import { z } from 'zod'

const searchSchema = z.object({
  tab: z
    .enum(['overview', 'users', 'activity', 'ads'])
    .optional()
    .default('overview'),
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

  const canAdmin = capabilities.includes('admin')
  if (user && !canAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Lock className="text-4xl text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don't have permission to access the admin area.
          </p>
          <Link
            to="/"
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Back to Home
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
  })

  const { data: activityStats, isLoading: activityLoading } = useQuery({
    queryKey: ['admin', 'activity-stats'],
    queryFn: () => getActivityStats(),
  })

  const { data: dauStats, isLoading: dauLoading } = useQuery({
    queryKey: ['admin', 'dau-stats'],
    queryFn: () => getActivityStatsAdmin(),
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
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Signups Chart */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="text-blue-500" />
              User Signups
            </h3>
            <Link
              to="/admin"
              search={{ tab: 'users' }}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              View details →
            </Link>
          </div>
          <CumulativeSignupsChart data={stats.signupsPerDay} height={200} />
        </Card>

        {/* Daily Active Users Chart */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Flame className="text-orange-500" />
              Daily Active Users
            </h3>
            <Link
              to="/admin"
              search={{ tab: 'activity' }}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              View details →
            </Link>
          </div>
          {dauStats ? (
            <DailyActiveUsersChart
              data={dauStats.dailyActiveUsers}
              height={200}
            />
          ) : (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          )}
        </Card>
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
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Daily Signups
          </h3>
          <DailySignupsChart data={stats.signupsPerDay} />
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Cumulative User Signups Over Time
          </h3>
          <CumulativeSignupsChart data={stats.signupsPerDay} />
        </Card>
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
          <Link
            to="/admin/users"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Manage Users
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
            <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              {dauStats.wau}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Weekly active users
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              MAU (30 days)
            </div>
            <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              {dauStats.mau}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Monthly active users
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
            <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              {activityStats.activeUsers.today}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Unique users who logged in
            </div>
          </Card>

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
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DAU Chart */}
        {dauStats && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Daily Active Users (30 days)
            </h3>
            <DailyActiveUsersChart data={dauStats.dailyActiveUsers} />
          </Card>
        )}

        {/* Daily Logins Chart */}
        {activityStats && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Daily Logins (30 days)
            </h3>
            <DailyLoginsChart data={activityStats.dailyLogins} />
          </Card>
        )}
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
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        provider === 'github'
                          ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}
                    >
                      {provider}
                    </span>
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

  return (
    <div className="space-y-6">
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
                  <span>Active: {stats.ads.waitlistWithAdsDisabledCount}</span>
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
                {((stats.ads.disabledCount / stats.totalUsers) * 100).toFixed(
                  1,
                )}
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

// Charts
function DailyActiveUsersChart({
  data,
  height = 200,
}: {
  data: Array<{ date: string; count: number }>
  height?: number
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
        height,
        marginLeft: 50,
        marginRight: 20,
        marginTop: 20,
        marginBottom: 40,
        x: { label: 'Date', type: 'utc', grid: true },
        y: { label: 'Active Users', grid: true },
        marks: [
          Plot.areaY(data, {
            x: (d) => new Date(d.date),
            y: 'count',
            fill: '#10b981',
            fillOpacity: 0.2,
            curve: 'monotone-x',
          }),
          Plot.lineY(data, {
            x: (d) => new Date(d.date),
            y: 'count',
            stroke: '#10b981',
            strokeWidth: 2,
            curve: 'monotone-x',
          }),
          Plot.dot(data, {
            x: (d) => new Date(d.date),
            y: 'count',
            fill: '#10b981',
            r: 3,
          }),
          Plot.tip(
            data,
            Plot.pointerX({
              x: (d) => new Date(d.date),
              y: 'count',
              title: (d) =>
                `${d.date}\n${d.count.toLocaleString()} active users`,
            }),
          ),
        ],
        style: { background: 'transparent', fontSize: '12px' },
      })

      container.appendChild(plot)
    }

    renderChart()
    const resizeObserver = new ResizeObserver(() => renderChart())
    resizeObserver.observe(container)
    return () => {
      resizeObserver.disconnect()
      container.innerHTML = ''
    }
  }, [data, height])

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600 dark:text-gray-400">
        No activity data available yet
      </div>
    )
  }

  return <div ref={containerRef} className="w-full" />
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
        x: { label: 'Date', type: 'utc', grid: true },
        y: { label: 'Logins', grid: true },
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
        style: { background: 'transparent', fontSize: '12px' },
      })

      container.appendChild(plot)
    }

    renderChart()
    const resizeObserver = new ResizeObserver(() => renderChart())
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
      container.innerHTML = ''

      const plot = Plot.plot({
        width: container.clientWidth,
        height: 300,
        marginLeft: 60,
        marginRight: 20,
        marginTop: 20,
        marginBottom: 40,
        x: { label: 'Date', type: 'utc', grid: true },
        y: { label: 'Daily Signups', grid: true },
        marks: [
          Plot.rectY(data, {
            x: (d) => new Date(d.date),
            y: 'count',
            fill: '#10b981',
            fillOpacity: 0.8,
            interval: 'day',
          }),
          Plot.tip(
            data,
            Plot.pointerX({
              x: (d) => new Date(d.date),
              y: 'count',
              title: (d) => `${d.date}\n${d.count.toLocaleString()} signups`,
            }),
          ),
        ],
        style: { background: 'transparent', fontSize: '12px' },
      })

      container.appendChild(plot)
    }

    renderChart()
    const resizeObserver = new ResizeObserver(() => renderChart())
    resizeObserver.observe(container)
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
  height = 300,
}: {
  data: Array<{ date: string; count: number }>
  height?: number
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
        height,
        marginLeft: 60,
        marginRight: 20,
        marginTop: 20,
        marginBottom: 40,
        x: { label: 'Date', type: 'utc', grid: true },
        y: { label: 'Total Users', grid: true },
        marks: [
          Plot.areaY(
            data,
            Plot.mapY('cumsum', {
              x: (d) => new Date(d.date),
              y: 'count',
              fill: '#3b82f6',
              fillOpacity: 0.2,
              curve: 'monotone-x',
            }),
          ),
          Plot.lineY(
            data,
            Plot.mapY('cumsum', {
              x: (d) => new Date(d.date),
              y: 'count',
              stroke: '#3b82f6',
              strokeWidth: 2,
              curve: 'monotone-x',
            }),
          ),
          Plot.dot(
            data,
            Plot.mapY('cumsum', {
              x: (d) => new Date(d.date),
              y: 'count',
              fill: '#3b82f6',
              r: 3,
            }),
          ),
          Plot.tip(
            data,
            Plot.pointerX(
              Plot.mapY('cumsum', {
                x: (d) => new Date(d.date),
                y: 'count',
                title: (d, i) => {
                  let cumSum = 0
                  for (let j = 0; j <= i; j++) {
                    cumSum += data[j].count
                  }
                  return `${d.date}\n${cumSum.toLocaleString()} total users`
                },
              }),
            ),
          ),
        ],
        style: { background: 'transparent', fontSize: '12px' },
      })

      container.appendChild(plot)
    }

    renderChart()
    const resizeObserver = new ResizeObserver(() => renderChart())
    resizeObserver.observe(container)
    return () => {
      resizeObserver.disconnect()
      container.innerHTML = ''
    }
  }, [data, height])

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-600 dark:text-gray-400">
        No signup data available yet
      </div>
    )
  }

  return <div ref={containerRef} className="w-full" />
}
