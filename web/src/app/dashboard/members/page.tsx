'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  Search, Filter, MoreVertical, Plus, Download, Upload, ChevronLeft, ChevronRight,
  Loader2, Tag, Trash2, CheckSquare, Square, X, MessageCircle
} from 'lucide-react'
import type { Member, Group, MemberStatus } from '@/types/database'

type MemberWithGroup = Member & { group?: { id: string; name: string } }

export default function MembersPage() {
  const [members, setMembers] = useState<MemberWithGroup[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalMembers, setTotalMembers] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState('')
  const [bulkTagInput, setBulkTagInput] = useState('')
  const [showBulkTag, setShowBulkTag] = useState(false)
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [tagFilter, setTagFilter] = useState('')
  const [allTags, setAllTags] = useState<string[]>([])
  const [inlineTagMemberId, setInlineTagMemberId] = useState<string | null>(null)
  const [inlineTagInput, setInlineTagInput] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const limit = 25

  // Close action menu when clicking outside or scrolling
  useEffect(() => {
    if (!actionMenuId) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActionMenuId(null)
        setMenuPos(null)
      }
    }
    function handleScroll() {
      setActionMenuId(null)
      setMenuPos(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [actionMenuId])

  const statusColors = {
    new: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    contacted: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
    qualified: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
    converted: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    archived: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
  } as const

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        sort_by: sortBy,
        sort_dir: sortDir,
      })
      if (searchTerm) params.set('search', searchTerm)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (groupFilter) params.set('group_id', groupFilter)
      if (tagFilter) params.set('tag', tagFilter)

      const res = await fetch(`/api/members?${params}`)
      const data = await res.json()

      setMembers(data.members || [])
      setTotalPages(data.totalPages || 1)
      setTotalMembers(data.total || 0)

      // Collect unique tags from all fetched members for the tag filter dropdown
      const tags = new Set<string>()
      ;(data.members || []).forEach((m: MemberWithGroup) => (m.tags || []).forEach((t: string) => tags.add(t)))
      setAllTags((prev) => {
        const merged = new Set([...prev, ...tags])
        return Array.from(merged).sort()
      })
    } catch (err) {
      console.error('Error fetching members:', err)
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm, statusFilter, groupFilter, tagFilter, sortBy, sortDir])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  useEffect(() => {
    async function loadGroups() {
      const res = await fetch('/api/groups')
      const data = await res.json()
      setGroups(data.groups || [])
    }
    loadGroups()
  }, [])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, groupFilter, tagFilter])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === members.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(members.map((m) => m.id)))
    }
  }

  const handleBulkStatusChange = async (newStatus: MemberStatus) => {
    const promises = Array.from(selectedIds).map((id) =>
      fetch(`/api/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
    )
    await Promise.all(promises)
    setSelectedIds(new Set())
    setBulkAction('')
    fetchMembers()
  }

  const handleBulkAddTag = async () => {
    if (!bulkTagInput.trim()) return
    const tag = bulkTagInput.trim().toLowerCase()

    const promises = Array.from(selectedIds).map(async (id) => {
      const member = members.find((m) => m.id === id)
      if (!member) return
      const newTags = [...new Set([...(member.tags || []), tag])]
      return fetch(`/api/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags }),
      })
    })
    await Promise.all(promises)
    setSelectedIds(new Set())
    setBulkTagInput('')
    setShowBulkTag(false)
    fetchMembers()
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} member(s)? This cannot be undone.`)) return
    const promises = Array.from(selectedIds).map((id) =>
      fetch(`/api/members/${id}`, { method: 'DELETE' })
    )
    await Promise.all(promises)
    setSelectedIds(new Set())
    fetchMembers()
  }

  const handleInlineAddTag = async (memberId: string) => {
    if (!inlineTagInput.trim()) return
    const tag = inlineTagInput.trim().toLowerCase()
    const member = members.find((m) => m.id === memberId)
    if (!member) return
    const newTags = [...new Set([...(member.tags || []), tag])]
    await fetch(`/api/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: newTags }),
    })
    setInlineTagMemberId(null)
    setInlineTagInput('')
    fetchMembers()
  }

  const handleRemoveTag = async (memberId: string, tagToRemove: string) => {
    const member = members.find((m) => m.id === memberId)
    if (!member) return
    const newTags = (member.tags || []).filter((t) => t !== tagToRemove)
    await fetch(`/api/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: newTags }),
    })
    fetchMembers()
  }

  const handleDeleteMember = async (id: string) => {
    if (!confirm('Delete this member?')) return
    await fetch(`/api/members/${id}`, { method: 'DELETE' })
    setActionMenuId(null)
    fetchMembers()
  }

  const handleExport = () => {
    const params = new URLSearchParams()
    if (groupFilter) params.set('group_id', groupFilter)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    window.open(`/api/members/export?${params}`, '_blank')
  }

  const handleImport = async (csvText: string) => {
    if (!groups.length) {
      alert('You need at least one group to import members into.')
      return
    }

    // Parse CSV
    const lines = csvText.trim().split('\n')
    if (lines.length < 2) {
      alert('CSV must have a header row and at least one data row.')
      return
    }

    const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim())
    const members = lines.slice(1).map((line) => {
      const values = line.match(/("([^"]|"")*"|[^,]*)/g) || []
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => {
        obj[h] = (values[i] || '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()
      })
      return obj
    })

    const groupId = groupFilter || groups[0].id
    const res = await fetch('/api/members/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId, members }),
    })
    const data = await res.json()

    if (res.ok) {
      alert(`Imported ${data.imported} members!`)
      setShowImportModal(false)
      fetchMembers()
    } else {
      alert(`Import error: ${data.error}`)
    }
  }

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDir('desc')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Members</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {totalMembers.toLocaleString()} total members across {groups.length} group{groups.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="converted">Converted</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        {allTags.length > 0 && (
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-gray-400" />
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              <option value="">All Tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}
        {groups.length > 1 && (
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            <option value="">All Groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {selectedIds.size} selected
          </span>
          <select
            value={bulkAction}
            onChange={(e) => {
              const val = e.target.value
              setBulkAction(val)
              if (val && val !== 'tag' && val !== 'delete') {
                handleBulkStatusChange(val as MemberStatus)
              }
              if (val === 'tag') setShowBulkTag(true)
              if (val === 'delete') handleBulkDelete()
            }}
            className="px-3 py-1.5 text-sm border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none"
          >
            <option value="">Change status...</option>
            <option value="new">Set New</option>
            <option value="contacted">Set Contacted</option>
            <option value="qualified">Set Qualified</option>
            <option value="converted">Set Converted</option>
            <option value="archived">Set Archived</option>
            <option value="tag">Add Tag...</option>
            <option value="delete">Delete Selected</option>
          </select>
          {showBulkTag && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Tag name"
                value={bulkTagInput}
                onChange={(e) => setBulkTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBulkAddTag()}
                className="px-3 py-1.5 text-sm border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none"
              />
              <button
                onClick={handleBulkAddTag}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add
              </button>
              <button onClick={() => setShowBulkTag(false)}>
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          )}
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-gray-500 hover:text-gray-700 ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm || statusFilter !== 'all' ? 'No members match your filters' : 'No members yet'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Members will appear here once captured via the Chrome extension.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <th className="px-4 py-3 text-left">
                    <button onClick={toggleSelectAll} className="p-1">
                      {selectedIds.size === members.length ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-900 dark:hover:text-white"
                    onClick={() => handleSort('name')}
                  >
                    Name {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-900 dark:hover:text-white"
                    onClick={() => handleSort('email')}
                  >
                    Email {sortBy === 'email' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                    Group
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-900 dark:hover:text-white"
                    onClick={() => handleSort('status')}
                  >
                    Status {sortBy === 'status' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                    Tags
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-900 dark:hover:text-white"
                    onClick={() => handleSort('created_at')}
                  >
                    Joined {sortBy === 'created_at' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition ${
                      selectedIds.has(member.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <td className="px-4 py-4">
                      <button onClick={() => toggleSelect(member.id)} className="p-1">
                        {selectedIds.has(member.id) ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </td>
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
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-wrap gap-1 items-center">
                        {(member.tags || []).map((tag) => (
                          <span
                            key={tag}
                            className="group/tag inline-flex items-center gap-0.5 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded text-xs"
                          >
                            {tag}
                            <button
                              onClick={() => handleRemoveTag(member.id, tag)}
                              className="opacity-0 group-hover/tag:opacity-100 ml-0.5 hover:text-red-600 transition-opacity"
                              title={`Remove tag "${tag}"`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        {inlineTagMemberId === member.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={inlineTagInput}
                              onChange={(e) => setInlineTagInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleInlineAddTag(member.id)
                                if (e.key === 'Escape') { setInlineTagMemberId(null); setInlineTagInput('') }
                              }}
                              placeholder="tag"
                              autoFocus
                              className="w-20 px-1.5 py-0.5 text-xs border border-indigo-300 dark:border-indigo-700 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <button
                              onClick={() => handleInlineAddTag(member.id)}
                              className="text-indigo-600 hover:text-indigo-800"
                            >
                              <CheckSquare className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => { setInlineTagMemberId(null); setInlineTagInput('') }}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setInlineTagMemberId(member.id)}
                            className="p-0.5 text-gray-400 hover:text-indigo-600 transition"
                            title="Add tag"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(member.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-1">
                        {(member.fb_user_id || member.fb_profile_url) && (
                          <a
                            href={
                              member.fb_user_id
                                ? `https://www.facebook.com/messages/t/${member.fb_user_id}`
                                : `${(member.fb_profile_url || '').replace(/\/$/, '')}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition"
                            title="Send Facebook Message"
                          >
                            <MessageCircle className="w-4 h-4 text-blue-600" />
                          </a>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (actionMenuId === member.id) {
                              setActionMenuId(null)
                              setMenuPos(null)
                            } else {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                              setMenuPos({ top: rect.bottom + 4, left: rect.right - 192 })
                              setActionMenuId(member.id)
                            }
                          }}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage} of {totalPages} ({totalMembers} total)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page: number
                if (totalPages <= 5) {
                  page = i + 1
                } else if (currentPage <= 3) {
                  page = i + 1
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i
                } else {
                  page = currentPage - 2 + i
                }
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {page}
                  </button>
                )
              })}
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Import Members from CSV</h3>
              <button onClick={() => setShowImportModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Upload a CSV file with columns: Name, Email, Phone, Tags, Notes, Facebook Profile
            </p>
            {groups.length > 1 && (
              <select
                value={groupFilter || groups[0]?.id}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  const reader = new FileReader()
                  reader.onload = (ev) => {
                    handleImport(ev.target?.result as string)
                  }
                  reader.readAsText(file)
                }
              }}
              className="w-full"
            />
            <button
              onClick={() => setShowImportModal(false)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action Menu Portal - rendered outside overflow containers */}
      {actionMenuId && menuPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1"
          style={{ top: menuPos.top, left: Math.max(0, menuPos.left), zIndex: 9999 }}
        >
          <Link
            href={`/dashboard/members/${actionMenuId}`}
            className="block px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => { setActionMenuId(null); setMenuPos(null) }}
          >
            View Details
          </Link>
          {(() => {
            const member = members.find(m => m.id === actionMenuId)
            if (!member) return null
            return (
              <>
                {member.fb_profile_url && (
                  <a
                    href={member.fb_profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => { setActionMenuId(null); setMenuPos(null) }}
                  >
                    Facebook Profile
                  </a>
                )}
                {(member.fb_user_id || member.fb_profile_url) && (
                  <a
                    href={
                      member.fb_user_id
                        ? `https://www.facebook.com/messages/t/${member.fb_user_id}`
                        : `${(member.fb_profile_url || '').replace(/\/$/, '')}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => { setActionMenuId(null); setMenuPos(null) }}
                  >
                    Send Message
                  </a>
                )}
                <button
                  onClick={() => handleDeleteMember(member.id)}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Delete
                </button>
              </>
            )
          })()}
        </div>,
        document.body
      )}
    </div>
  )
}
