'use client'

import { useState, useEffect } from 'react'
import { Plus, Users, CheckCircle, ExternalLink, Loader2, Pencil, Trash2, X, Crown } from 'lucide-react'
import type { Group } from '@/types/database'

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupUrl, setNewGroupUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [groupLimit, setGroupLimit] = useState<{ current: number; limit: number } | null>(null)

  useEffect(() => {
    fetchGroups()
  }, [])

  async function fetchGroups() {
    try {
      const res = await fetch('/api/groups')
      const data = await res.json()
      setGroups(data.groups || [])
    } catch (err) {
      console.error('Error fetching groups:', err)
    } finally {
      setLoading(false)
    }
  }

  // Check plan limits when groups load
  useEffect(() => {
    // We derive limit info from a test POST or from an explicit endpoint
    // For now, we track it by attempting to get plan info
    async function checkLimits() {
      try {
        const res = await fetch('/api/plan-limits')
        if (res.ok) {
          const data = await res.json()
          setGroupLimit({ current: groups.length, limit: data.limits?.groups ?? 1 })
        }
      } catch {
        // Fallback: no limit info available
      }
    }
    if (!loading) checkLimits()
  }, [groups, loading])

  const atLimit = groupLimit && groupLimit.limit !== -1 && groups.length >= groupLimit.limit

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return
    setAdding(true)
    setAddError('')
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName.trim(),
          fb_group_url: newGroupUrl.trim() || null,
          fb_group_id: newGroupUrl.match(/groups\/(\d+)/)?.[1] || null,
        }),
      })
      if (res.ok) {
        setNewGroupName('')
        setNewGroupUrl('')
        setShowAddModal(false)
        fetchGroups()
      } else {
        const data = await res.json()
        if (data.code === 'PLAN_LIMIT_REACHED') {
          setAddError(`You've reached your plan limit of ${data.limit} group${data.limit === 1 ? '' : 's'}. Upgrade your plan to add more.`)
        } else {
          setAddError(data.error || 'Failed to add group')
        }
      }
    } catch (err) {
      console.error('Error adding group:', err)
      setAddError('Something went wrong. Please try again.')
    } finally {
      setAdding(false)
    }
  }

  const handleEditGroup = (group: Group) => {
    setEditingId(group.id)
    setEditName(group.name)
    setEditUrl(group.fb_group_url || '')
  }

  const handleSaveEdit = async (groupId: string) => {
    if (!editName.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          fb_group_url: editUrl.trim() || null,
        }),
      })
      if (res.ok) {
        setEditingId(null)
        fetchGroups()
      }
    } catch (err) {
      console.error('Error updating group:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Delete this group? All members in this group will also be removed. This cannot be undone.')) return
    try {
      await fetch(`/api/groups/${groupId}`, { method: 'DELETE' })
      fetchGroups()
    } catch (err) {
      console.error('Error deleting group:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Groups</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your connected Facebook groups
            {groupLimit && groupLimit.limit !== -1 && (
              <span className="ml-2 text-sm">
                ({groups.length}/{groupLimit.limit} used)
              </span>
            )}
          </p>
        </div>
        {atLimit ? (
          <a
            href="/dashboard/settings?tab=subscription"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-lg transition"
          >
            <Crown className="w-4 h-4" />
            Upgrade to Add More
          </a>
        ) : (
          <button
            onClick={() => { setShowAddModal(true); setAddError('') }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            Add Group
          </button>
        )}
      </div>

      {/* Connection Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h3 className="font-semibold mb-3">How to connect a Facebook group</h3>
        <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li className="flex gap-3">
            <span className="flex-shrink-0 font-bold text-blue-600 dark:text-blue-400">1</span>
            <span>Add your group here using the &quot;Add Group&quot; button</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 font-bold text-blue-600 dark:text-blue-400">2</span>
            <span>Install the GroupBase Chrome extension and sign in</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 font-bold text-blue-600 dark:text-blue-400">3</span>
            <span>Go to your Facebook group&apos;s member requests page</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 font-bold text-blue-600 dark:text-blue-400">4</span>
            <span>Approve members — the extension captures their data automatically</span>
          </li>
        </ol>
      </div>

      {/* Groups Grid */}
      {groups.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-12 text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No groups connected yet</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Add your first Facebook group to start capturing member data
          </p>
          <button
            onClick={() => { setShowAddModal(true); setAddError('') }}
            className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            Add Your First Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <div
              key={group.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition"
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                {editingId === group.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Group Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Facebook URL</label>
                      <input
                        type="url"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        placeholder="https://facebook.com/groups/..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(group.id)}
                        disabled={saving || !editName.trim()}
                        className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-bold">{group.name}</h3>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditGroup(group)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
                          title="Edit group"
                        >
                          <Pencil className="w-4 h-4 text-gray-400 hover:text-blue-500" />
                        </button>
                        {group.fb_group_url && (
                          <a
                            href={group.fb_group_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
                            title="Open Facebook group"
                          >
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                          </a>
                        )}
                        <button
                          onClick={() => handleDeleteGroup(group.id)}
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                          title="Delete group"
                        >
                          <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">{group.member_count.toLocaleString()} members captured</span>
                    </div>
                  </>
                )}
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase mb-2">Status</p>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">Active</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase mb-1">Created</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {new Date(group.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Group Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Add a Facebook Group</h3>
              <button onClick={() => setShowAddModal(false)}>
                <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            {addError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                {addError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Group Name
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g. GroupCraft: Build Your Community"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Facebook Group URL (optional)
              </label>
              <input
                type="url"
                value={newGroupUrl}
                onChange={(e) => setNewGroupUrl(e.target.value)}
                placeholder="https://facebook.com/groups/..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleAddGroup}
                disabled={adding || !newGroupName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
              >
                {adding ? 'Adding...' : 'Add Group'}
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
