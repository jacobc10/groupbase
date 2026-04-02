'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Zap, TrendingUp, CheckCircle, ArrowUpRight, Filter, Plus, Loader2 } from 'lucide-react'
import type { Member, Group } from '@/types/database'

interface DashboardStats {
  totalMembers: number
  membersToday: number
  membersThisWeek: number
  activeGroups: number
  conversionRate: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentMembers, setRecentMembers] = useState<(Member & { group?: { name: string } })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        // Load members (recent 5 for the table)
        const membersRes = await fetch('/api/members?limit=5&sort_by=created_at&sort_dir=desc')
        const membersData = await membersRes.json()

        // Load all members count for stats
        const allRes = await fetch('/api/members?limit=1&page=1')
        const allData = await allRes.json()

        // Load groups
        const groupsRes = await fetch('/api/groups')
        const groupsData = await groupsRes.json()

        const totalMembers = allData.total || 0
        const members = membersData.members || []

        // Calculate stats from member data
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

        // Fetch today's count
        const todayRes = await fetch(`/api/members?limit=1&page=1&sort_by=created_at`)
        const todayData = await todayRes.json()

        const convertedCount = members.filter((m: Member) => m.status === 'converted').length

        setStats({
          totalMembers,
          membersToday: todayData.total > 0 ? Math.min(todayData.total, totalMembers) : 0,
          membersThisWeek: totalMembers, // approximate for now
          activeGroups: groupsData.groups?.length || 0,
          conversionRate: totalMembers > 0 ? (convertedCount / totalMembers) * 100 : 0,
        })

        setRecentMembers(members)
      } catch (err) {
        console.error('Error loading dashboard:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  const statusColors = {
    new: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    contacted: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
    qualified: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
    converted: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    archived: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
  } as const

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const statCards = [
    {
      label: 'Total Members',
      value: stats?.totalMembers?.toLocaleString() || '0',
      icon: Users,
      color: 'bg-indigo-100 dark:bg-indigo-900',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      label: 'Members Today',
      value: stats?.membersToday?.toString() || '0',
      icon: TrendingUp,
      color: 'bg-green-100 dark:bg-green-900',
      iconColor: 'text-green-600 dark:text-green-400',
    },
    {
      label: 'Active Groups',
      value: stats?.activeGroups?.toString() || '0',
      icon: Zap,
      color: 'bg-orange-100 dark:bg-orange-900',
      iconColor: 'text-orange-600 dark:text-orange-400',
    },
    {
      label: 'Conversion Rate',
      value: `${(stats?.conversionRate || 0).toFixed(1)}%`,
      icon: CheckCircle,
      color: 'bg-blue-100 dark:bg-blue-900',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Welcome back! Here&apos;s what&apos;s happening with your groups.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className={`w-6 h-6 ${stat.iconColor}`} />
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                {stat.label}
              </p>
              <p className="text-3xl font-bold">{stat.value}</p>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            Quick Actions
          </h3>
          <div className="space-y-2">
            <Link
              href="/dashboard/members"
              className="w-full block text-left px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-sm"
            >
              View all members
            </Link>
            <Link
              href="/dashboard/groups"
              className="w-full block text-left px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-sm"
            >
              Manage groups
            </Link>
            <Link
              href="/dashboard/integrations"
              className="w-full block text-left px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-sm"
            >
              Configure integrations
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Conversion Rate
          </h3>
          <div className="space-y-2">
            <div>
              <p className="text-2xl font-bold">{(stats?.conversionRate || 0).toFixed(1)}%</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Members to customers
              </p>
            </div>
            <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(stats?.conversionRate || 0, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-600" />
            Groups Connected
          </h3>
          <div className="space-y-2">
            <p className="text-2xl font-bold">{stats?.activeGroups || 0}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Facebook groups tracked
            </p>
            <Link
              href="/dashboard/groups"
              className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2"
            >
              Manage <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Members Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold">Recent Members</h2>
          <Link
            href="/dashboard/members"
            className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            View all <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {recentMembers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No members yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Install the Chrome extension and approve members in your Facebook group to start capturing data.
            </p>
            <Link
              href="/dashboard/groups"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Connect a Group
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Group</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
                  >
                    <td className="px-6 py-4 text-sm font-medium">
                      <Link href={`/dashboard/members/${member.id}`} className="hover:text-blue-600">
                        {member.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {member.email || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {member.group?.name || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[member.status as keyof typeof statusColors] || statusColors.new}`}>
                        {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(member.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
