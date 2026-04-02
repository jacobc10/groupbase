'use client'

import { useState, useEffect } from 'react'
import { Users, UserPlus, Shield, ShieldCheck, Crown, MoreVertical, Loader2, X, Mail } from 'lucide-react'
import { useRouter } from 'next/navigation'

type TeamMember = {
  id: string
  full_name: string | null
  email: string
  role: 'owner' | 'admin' | 'member'
  created_at: string
}

type TeamData = {
  team_name: string
  members: TeamMember[]
  current_user_id: string
  current_user_role: 'owner' | 'admin' | 'member'
  plan: string
  plan_seat_limit: number
}

const PLAN_SEAT_LIMITS: Record<string, number> = {
  free: 1,
  pro: 3,
  enterprise: Infinity,
}

const ROLE_COLORS = {
  owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  member: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
}

const ROLE_ICONS = {
  owner: Crown,
  admin: ShieldCheck,
  member: Shield,
}

export default function TeamPage() {
  const [teamData, setTeamData] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviting, setInviting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ type: 'remove' | 'changeRole'; userId: string; newRole?: 'admin' | 'member' } | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchTeamData()
  }, [])

  async function fetchTeamData() {
    try {
      const res = await fetch('/api/team')
      if (!res.ok) throw new Error('Failed to fetch team data')
      const data = await res.json()
      setTeamData(data)
    } catch (error) {
      console.error('Error fetching team data:', error)
      setMessage({ type: 'error', text: 'Failed to load team data' })
    } finally {
      setLoading(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    setInviting(true)
    setMessage(null)

    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'Invitation sent successfully' })
        setInviteEmail('')
        setInviteRole('member')
        // Refresh team data to show new member if immediately accepted
        await fetchTeamData()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send invitation' })
      }
    } catch (error) {
      console.error('Error sending invitation:', error)
      setMessage({ type: 'error', text: 'Something went wrong. Please try again.' })
    } finally {
      setInviting(false)
    }
  }

  async function handleChangeRole(userId: string, newRole: 'admin' | 'member') {
    setConfirmDialog({ type: 'changeRole', userId, newRole })
  }

  async function handleRemove(userId: string) {
    setConfirmDialog({ type: 'remove', userId })
  }

  async function confirmAction() {
    if (!confirmDialog) return

    try {
      const method = confirmDialog.type === 'remove' ? 'DELETE' : 'PATCH'
      const body = confirmDialog.type === 'remove' ? undefined : JSON.stringify({ role: confirmDialog.newRole })

      const res = await fetch(`/api/team/${confirmDialog.userId}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
      })

      if (res.ok) {
        const actionText = confirmDialog.type === 'remove' ? 'removed' : 'role updated'
        setMessage({ type: 'success', text: `Member ${actionText} successfully` })
        await fetchTeamData()
      } else {
        setMessage({ type: 'error', text: 'Failed to update member' })
      }
    } catch (error) {
      console.error('Error updating member:', error)
      setMessage({ type: 'error', text: 'Something went wrong. Please try again.' })
    } finally {
      setConfirmDialog(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!teamData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">Failed to load team data</p>
      </div>
    )
  }

  const isOwner = teamData.current_user_role === 'owner'
  const seatsUsed = teamData.members.length
  const seatLimit = PLAN_SEAT_LIMITS[teamData.plan] || 1
  const seatsAvailable = seatLimit === Infinity ? Infinity : seatLimit - seatsUsed
  const canInvite = seatsAvailable > 0

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{teamData.team_name}</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          {seatsUsed} {seatsUsed === 1 ? 'member' : 'members'}
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
          }`}
        >
          <div className="flex-1 text-sm">{message.text}</div>
          <button
            onClick={() => setMessage(null)}
            className="flex-shrink-0 text-current opacity-70 hover:opacity-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Invite Form - Only show if user is owner */}
      {isOwner && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            Invite Team Member
          </h2>

          {/* Seat Limit Info */}
          <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
            <p className="text-sm text-indigo-800 dark:text-indigo-300">
              {seatLimit === Infinity ? (
                <>Unlimited seats available</>
              ) : (
                <>
                  {seatsUsed} of {seatLimit} seats used
                  {seatsAvailable === 0 && (
                    <span className="block mt-1 font-semibold">
                      Upgrade your plan to add more team members
                    </span>
                  )}
                </>
              )}
            </p>
          </div>

          {!canInvite && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                You've reached the seat limit for your plan. Please upgrade to invite more team members.
              </p>
            </div>
          )}

          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  disabled={!canInvite || inviting}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                  disabled={!canInvite || inviting}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={!inviteEmail.trim() || !canInvite || inviting}
              className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {inviting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Send Invitation
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Team Members Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Team Members</h2>
        </div>

        {teamData.members.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-50" />
            <p className="text-gray-600 dark:text-gray-400 mb-1">No team members yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {isOwner ? 'Invite your first team member using the form above.' : 'Waiting for the team owner to add members.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Joined</th>
                  {isOwner && (
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {teamData.members.map((member) => {
                  const isCurrentUser = member.id === teamData.current_user_id
                  const isOwnerRow = member.role === 'owner'
                  const RoleIcon = ROLE_ICONS[member.role]
                  const joiningDate = new Date(member.created_at)
                  const formattedDate = joiningDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })

                  return (
                    <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        {member.full_name || 'Unknown'}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 px-2 py-1 rounded">
                            You
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {member.email}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                            ROLE_COLORS[member.role]
                          }`}
                        >
                          <RoleIcon className="w-3 h-3" />
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {formattedDate}
                      </td>
                      {isOwner && (
                        <td className="px-6 py-4 text-right">
                          {!isOwnerRow && !isCurrentUser ? (
                            <div className="relative">
                              <button
                                onClick={() => setOpenDropdown(openDropdown === member.id ? null : member.id)}
                                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {openDropdown === member.id && (
                                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10">
                                  {member.role !== 'admin' && (
                                    <button
                                      onClick={() => {
                                        handleChangeRole(member.id, 'admin')
                                        setOpenDropdown(null)
                                      }}
                                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 first:rounded-t-lg transition"
                                    >
                                      Make Admin
                                    </button>
                                  )}
                                  {member.role === 'admin' && (
                                    <button
                                      onClick={() => {
                                        handleChangeRole(member.id, 'member')
                                        setOpenDropdown(null)
                                      }}
                                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 first:rounded-t-lg transition"
                                    >
                                      Make Member
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      handleRemove(member.id)
                                      setOpenDropdown(null)
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 last:rounded-b-lg transition"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-sm w-full p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {confirmDialog.type === 'remove' ? 'Remove Member' : 'Change Role'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {confirmDialog.type === 'remove'
                ? 'Are you sure you want to remove this member from the team? This action cannot be undone.'
                : `Change this member's role to ${confirmDialog.newRole === 'admin' ? 'Admin' : 'Member'}?`}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                className={`px-4 py-2 text-white rounded-lg font-medium transition ${
                  confirmDialog.type === 'remove'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {confirmDialog.type === 'remove' ? 'Remove' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
