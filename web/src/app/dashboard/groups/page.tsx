'use client'

import { useState, useEffect } from 'react'
import { Plus, Users, CheckCircle, ExternalLink, Loader2, Trash2 } from 'lucide-react'
import type { Group } from '@/types/database'

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupUrl, setNewGroupUrl] = useState('')
  const [adding, setAdding] = useState(false)

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

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return
    setAdding(true)
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
      }
    } catch (err) {
      console.error('Error adding group:', err)
    } finally {
      setAdding(false)
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
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          Add Group
        </button>
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
            onClick={() => setShowAddModal(true)}
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
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold">{group.name}</h3>
                  {group.fb_group_url && (
                    <a
                      href={group.fb_group_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">{group.member_count.toLocaleString()} members captured</span>
                </div>
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
            <h3 className="text-lg font-bold">Add a Facebook Group</h3>
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
