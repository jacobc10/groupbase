'use client'

import { useState, useEffect } from 'react'
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  Tag,
  Activity,
  Loader2,
} from 'lucide-react'

interface AnalyticsData {
  growthChart: Array<{ date: string; count: number }>
  statusFunnel: {
    new: number
    contacted: number
    qualified: number
    converted: number
  }
  weekOverWeekGrowth: number
  membersByGroup: Array<{ groupName: string; count: number }>
  topTags: Array<{ tag: string; count: number }>
  recentActivity: Array<{
    id: string
    action: string
    timestamp: string
    details?: string | Record<string, unknown>
  }>
}

// Helper function to format activity details (can be string or object)
function formatDetails(details: string | Record<string, unknown> | null | undefined): string {
  if (!details) return ''
  if (typeof details === 'string') return details
  if (typeof details === 'object') {
    // Format known fields nicely
    const parts: string[] = []
    if ('fb_name' in details && details.fb_name) parts.push(`${details.fb_name}`)
    if ('source' in details && details.source) parts.push(`via ${String(details.source).replace(/_/g, ' ')}`)
    if (parts.length > 0) return parts.join(' — ')
    return JSON.stringify(details)
  }
  return String(details)
}

// Helper function to format action names
function formatAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// Helper function to format relative time
function getRelativeTime(timestamp: string): string {
  const now = new Date()
  const past = new Date(timestamp)
  const diffMs = now.getTime() - past.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays === 7) return 'a week ago'
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return 'a month ago'
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const response = await fetch('/api/analytics')
        if (!response.ok) throw new Error('Failed to fetch analytics')
        const json = await response.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
          <p className="text-gray-600 dark:text-gray-400">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-md">
          <p className="text-red-600 dark:text-red-400">Error: {error || 'No data available'}</p>
        </div>
      </div>
    )
  }

  const maxGrowthValue = Math.max(...data.growthChart.map((d) => d.count), 1)
  const totalFunnelValue =
    data.statusFunnel.new +
    data.statusFunnel.contacted +
    data.statusFunnel.qualified +
    data.statusFunnel.converted
  const maxGroupValue = Math.max(...data.membersByGroup.map((g) => g.count), 1)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Analytics Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time insights into your group growth and engagement
          </p>
        </div>

        {/* Growth Rate Card */}
        <div className="mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-2">
                  Week-over-Week Growth
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-gray-900 dark:text-white">
                    {Math.abs(data.weekOverWeekGrowth).toLocaleString()}%
                  </span>
                  {data.weekOverWeekGrowth >= 0 ? (
                    <TrendingUp className="w-8 h-8 text-green-500" />
                  ) : (
                    <TrendingDown className="w-8 h-8 text-red-500" />
                  )}
                </div>
              </div>
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  data.weekOverWeekGrowth >= 0
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-red-100 dark:bg-red-900/30'
                }`}
              >
                <BarChart3
                  className={`w-8 h-8 ${
                    data.weekOverWeekGrowth >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Growth Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Members Growth (30 Days)
            </h2>
            <div className="flex flex-col gap-4">
              {/* Chart */}
              <div className="flex items-end gap-1 h-40 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
                {data.growthChart.map((point, idx) => {
                  const heightPercent = (point.count / maxGrowthValue) * 100
                  const minHeight = Math.max(heightPercent, 8)
                  return (
                    <div
                      key={idx}
                      className="flex-1 bg-indigo-500 hover:bg-indigo-400 rounded-t transition-colors duration-200 relative group cursor-pointer min-h-2"
                      style={{ height: `${minHeight}%` }}
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-950 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                        {point.date.split('-').slice(1).join('/')}
                        <br />
                        {point.count} members
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* X-axis labels (every 7th day) */}
              <div className="flex text-xs text-gray-500 dark:text-gray-400 px-4">
                {data.growthChart.map((point, idx) => {
                  if (idx % 7 === 0) {
                    return (
                      <div key={idx} className="flex-1 text-center">
                        {point.date.split('-')[2]}
                      </div>
                    )
                  }
                  return (
                    <div key={idx} className="flex-1" />
                  )
                })}
              </div>
            </div>
          </div>

          {/* Status Funnel */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Member Status Funnel
            </h2>
            <div className="space-y-4">
              {/* New */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    New
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {data.statusFunnel.new.toLocaleString()}
                  </span>
                </div>
                <div className="w-full h-8 bg-gray-300 dark:bg-gray-600 rounded overflow-hidden">
                  <div
                    className="h-full bg-gray-500 dark:bg-gray-400 transition-all duration-300"
                    style={{
                      width: `${
                        totalFunnelValue > 0
                          ? (data.statusFunnel.new / totalFunnelValue) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Contacted */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Contacted
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {data.statusFunnel.contacted.toLocaleString()}
                  </span>
                </div>
                <div className="w-full h-8 bg-blue-200 dark:bg-blue-900/40 rounded overflow-hidden">
                  <div
                    className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-300"
                    style={{
                      width: `${
                        totalFunnelValue > 0
                          ? (data.statusFunnel.contacted / totalFunnelValue) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Qualified */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Qualified
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {data.statusFunnel.qualified.toLocaleString()}
                  </span>
                </div>
                <div className="w-full h-8 bg-yellow-200 dark:bg-yellow-900/40 rounded overflow-hidden">
                  <div
                    className="h-full bg-yellow-500 dark:bg-yellow-400 transition-all duration-300"
                    style={{
                      width: `${
                        totalFunnelValue > 0
                          ? (data.statusFunnel.qualified / totalFunnelValue) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Converted */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Converted
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {data.statusFunnel.converted.toLocaleString()}
                  </span>
                </div>
                <div className="w-full h-8 bg-green-200 dark:bg-green-900/40 rounded overflow-hidden">
                  <div
                    className="h-full bg-green-500 dark:bg-green-400 transition-all duration-300"
                    style={{
                      width: `${
                        totalFunnelValue > 0
                          ? (data.statusFunnel.converted / totalFunnelValue) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Members by Group */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Members by Group
              </h2>
            </div>
            <div className="space-y-4">
              {data.membersByGroup.map((group, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {group.groupName}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {group.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 dark:from-indigo-400 dark:to-indigo-300 transition-all duration-300"
                      style={{
                        width: `${
                          maxGroupValue > 0 ? (group.count / maxGroupValue) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Tags */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Tag className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Top Tags
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.topTags.slice(0, 12).map((tag, idx) => {
                const maxCount = Math.max(...data.topTags.map((t) => t.count))
                const sizePercent = (tag.count / maxCount) * 100
                const baseSizePx = 14
                const maxSizePx = 28
                const fontSize =
                  baseSizePx + (sizePercent / 100) * (maxSizePx - baseSizePx)

                return (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full font-medium transition-transform duration-200 hover:scale-110 cursor-default"
                    style={{ fontSize: `${fontSize}px` }}
                    title={`${tag.tag}: ${tag.count} uses`}
                  >
                    {tag.tag}
                  </span>
                )
              })}
            </div>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Activity
            </h2>
          </div>
          <div className="space-y-4">
            {data.recentActivity.length > 0 ? (
              data.recentActivity.map((activity, idx) => (
                <div
                  key={activity.id}
                  className="flex gap-4 pb-4 border-b border-gray-200 dark:border-gray-700 last:border-0 last:pb-0"
                >
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="w-3 h-3 bg-indigo-500 dark:bg-indigo-400 rounded-full mt-1" />
                    {idx < data.recentActivity.length - 1 && (
                      <div className="w-0.5 h-12 bg-gray-200 dark:bg-gray-700 my-2" />
                    )}
                  </div>

                  {/* Activity content */}
                  <div className="flex-1 py-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatAction(activity.action)}
                    </p>
                    {activity.details && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {formatDetails(activity.details)}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      {getRelativeTime(activity.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                No recent activity
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
