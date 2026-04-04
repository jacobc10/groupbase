'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Plus,
  Search,
  Settings,
  GripVertical,
  User,
  Mail,
  Tag,
  ChevronDown,
  X,
  Loader2,
  Pencil,
  Trash2,
  MessageCircle,
  ExternalLink,
  MoreHorizontal,
} from 'lucide-react'
import type { Pipeline, PipelineStage, PipelineMember, Member, MemberStatus } from '@/types/database'

const STATUS_COLORS: Record<MemberStatus, string> = {
  new: 'bg-gray-500',
  contacted: 'bg-blue-500',
  qualified: 'bg-yellow-500',
  converted: 'bg-green-500',
  archived: 'bg-red-500',
}

const STAGE_COLORS = [
  '#6B7280', '#3B82F6', '#F59E0B', '#10B981', '#8B5CF6',
  '#EF4444', '#EC4899', '#14B8A6', '#F97316', '#6366F1',
]

const STATUS_OPTIONS: { value: MemberStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'converted', label: 'Converted' },
  { value: 'archived', label: 'Archived' },
]

export default function PipelinePage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null)
  const [activePipeline, setActivePipeline] = useState<Pipeline | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingPipeline, setLoadingPipeline] = useState(false)

  // Modals
  const [showCreatePipeline, setShowCreatePipeline] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showEditPipeline, setShowEditPipeline] = useState(false)
  const [addToStageId, setAddToStageId] = useState<string | null>(null)

  // Create pipeline form
  const [newPipelineName, setNewPipelineName] = useState('')

  // Add member search
  const [memberSearch, setMemberSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Member[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Drag state
  const [dragMemberId, setDragMemberId] = useState<string | null>(null)
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null)

  // Edit pipeline
  const [editStages, setEditStages] = useState<PipelineStage[]>([])
  const [editPipelineName, setEditPipelineName] = useState('')

  // Load pipelines list
  useEffect(() => {
    loadPipelines()
  }, [])

  // Load active pipeline details when ID changes
  useEffect(() => {
    if (activePipelineId) {
      loadPipelineDetails(activePipelineId)
    }
  }, [activePipelineId])

  async function loadPipelines() {
    setLoading(true)
    const res = await fetch('/api/pipelines')
    const data = await res.json()
    setPipelines(data.pipelines || [])

    // Auto-select first pipeline
    if (data.pipelines?.length > 0 && !activePipelineId) {
      const defaultPipeline = data.pipelines.find((p: Pipeline) => p.is_default) || data.pipelines[0]
      setActivePipelineId(defaultPipeline.id)
    }
    setLoading(false)
  }

  async function loadPipelineDetails(id: string) {
    setLoadingPipeline(true)
    const res = await fetch(`/api/pipelines/${id}`)
    const data = await res.json()
    setActivePipeline(data.pipeline || null)
    setLoadingPipeline(false)
  }

  async function createPipeline() {
    if (!newPipelineName.trim()) return
    const res = await fetch('/api/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newPipelineName }),
    })
    const data = await res.json()
    if (data.pipeline) {
      setPipelines(prev => [...prev, data.pipeline])
      setActivePipelineId(data.pipeline.id)
      setNewPipelineName('')
      setShowCreatePipeline(false)
    }
  }

  async function deletePipeline(id: string) {
    await fetch(`/api/pipelines/${id}`, { method: 'DELETE' })
    setPipelines(prev => prev.filter(p => p.id !== id))
    if (activePipelineId === id) {
      const remaining = pipelines.filter(p => p.id !== id)
      setActivePipelineId(remaining[0]?.id || null)
      setActivePipeline(null)
    }
  }

  // Search members to add
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function getExistingMemberIds(): Set<string> {
    return new Set(
      activePipeline?.stages?.flatMap(s =>
        (s.pipeline_members || []).map(pm => pm.member_id)
      ) || []
    )
  }

  async function loadRecentMembers() {
    setSearchLoading(true)
    const res = await fetch('/api/members?sort_by=created_at&limit=10')
    const data = await res.json()
    const existingIds = getExistingMemberIds()
    setSearchResults((data.members || []).filter((m: Member) => !existingIds.has(m.id)))
    setSearchLoading(false)
  }

  function handleMemberSearch(query: string) {
    setMemberSearch(query)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!query.trim()) {
      loadRecentMembers()
      return
    }
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true)
      const res = await fetch(`/api/members?search=${encodeURIComponent(query)}&limit=10`)
      const data = await res.json()
      setSearchResults(data.members || [])
      setSearchLoading(false)
    }, 300)
  }

  async function addMemberToPipeline(memberId: string) {
    if (!activePipelineId || !addToStageId) return
    await fetch(`/api/pipelines/${activePipelineId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_ids: [memberId], stage_id: addToStageId }),
    })
    setShowAddMember(false)
    setMemberSearch('')
    setSearchResults([])
    loadPipelineDetails(activePipelineId)
  }

  async function removeMemberFromPipeline(memberId: string) {
    if (!activePipelineId) return
    await fetch(`/api/pipelines/${activePipelineId}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId }),
    })
    loadPipelineDetails(activePipelineId)
  }

  // Drag and drop handlers
  function handleDragStart(memberId: string) {
    setDragMemberId(memberId)
  }

  function handleDragOver(e: React.DragEvent, stageId: string) {
    e.preventDefault()
    setDragOverStageId(stageId)
  }

  function handleDragLeave() {
    setDragOverStageId(null)
  }

  async function handleDrop(stageId: string) {
    if (!dragMemberId || !activePipelineId) return
    setDragOverStageId(null)
    setDragMemberId(null)

    // Optimistic update
    setActivePipeline(prev => {
      if (!prev?.stages) return prev
      let draggedPm: PipelineMember | null = null

      const newStages = prev.stages!.map(stage => {
        const member = stage.pipeline_members?.find(pm => pm.member_id === dragMemberId)
        if (member) draggedPm = member
        return {
          ...stage,
          pipeline_members: (stage.pipeline_members || []).filter(pm => pm.member_id !== dragMemberId)
        }
      })

      if (draggedPm) {
        return {
          ...prev,
          stages: newStages.map(stage => {
            if (stage.id === stageId) {
              return {
                ...stage,
                pipeline_members: [...(stage.pipeline_members || []), { ...draggedPm!, stage_id: stageId }]
              }
            }
            return stage
          })
        }
      }
      return prev
    })

    // API call
    await fetch(`/api/pipelines/${activePipelineId}/members`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: dragMemberId, stage_id: stageId }),
    })

    // Reload to get updated member status
    loadPipelineDetails(activePipelineId)
  }

  // Edit pipeline
  function openEditPipeline() {
    if (!activePipeline) return
    setEditPipelineName(activePipeline.name)
    setEditStages((activePipeline.stages || []).map(s => ({ ...s })))
    setShowEditPipeline(true)
  }

  async function saveEditPipeline() {
    if (!activePipelineId) return

    // Update pipeline name
    await fetch(`/api/pipelines/${activePipelineId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editPipelineName }),
    })

    // Update stages
    await fetch(`/api/pipelines/${activePipelineId}/stages`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stages: editStages.map((s, i) => ({
          id: s.id,
          name: s.name,
          color: s.color,
          position: i,
          status_mapping: s.status_mapping,
        }))
      }),
    })

    setShowEditPipeline(false)
    loadPipelines()
    loadPipelineDetails(activePipelineId)
  }

  async function addStageToEdit() {
    if (!activePipelineId) return
    const res = await fetch(`/api/pipelines/${activePipelineId}/stages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Stage',
        color: STAGE_COLORS[editStages.length % STAGE_COLORS.length],
      }),
    })
    const data = await res.json()
    if (data.stage) {
      setEditStages(prev => [...prev, data.stage])
    }
  }

  async function deleteStageFromEdit(stageId: string) {
    if (!activePipelineId) return
    await fetch(`/api/pipelines/${activePipelineId}/stages`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_id: stageId }),
    })
    setEditStages(prev => prev.filter(s => s.id !== stageId))
  }

  // Empty state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (pipelines.length === 0) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="8" width="5" height="13" rx="1"/><rect x="17" y="5" width="5" height="16" rx="1"/></svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Create Your First Pipeline</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          Track your group members through your sales process with a visual Kanban board. Drag and drop members between stages.
        </p>
        <button
          onClick={() => setShowCreatePipeline(true)}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
        >
          <Plus className="w-5 h-5" />
          Create Pipeline
        </button>

        {/* Create Pipeline Modal */}
        {showCreatePipeline && (
          <CreatePipelineModal
            name={newPipelineName}
            setName={setNewPipelineName}
            onCreate={createPipeline}
            onClose={() => setShowCreatePipeline(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col -m-6">
      {/* Pipeline Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Pipeline</h1>

        {/* Pipeline Selector */}
        <div className="relative">
          <select
            value={activePipelineId || ''}
            onChange={(e) => setActivePipelineId(e.target.value)}
            className="appearance-none bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
          >
            {pipelines.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        <div className="flex-1" />

        <button
          onClick={openEditPipeline}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
        >
          <Settings className="w-4 h-4" />
          Edit Pipeline
        </button>

        <button
          onClick={() => setShowCreatePipeline(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" />
          New Pipeline
        </button>
      </div>

      {/* Kanban Board */}
      {loadingPipeline ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-4 h-full min-h-[500px]">
            {(activePipeline?.stages || []).map(stage => (
              <div
                key={stage.id}
                className={`flex-shrink-0 w-80 flex flex-col bg-gray-100 dark:bg-gray-800/50 rounded-xl ${
                  dragOverStageId === stage.id ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(stage.id)}
              >
                {/* Stage Header */}
                <div className="px-4 py-3 flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stage.color }}
                  />
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex-1">
                    {stage.name}
                  </h3>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                    {stage.pipeline_members?.length || 0}
                  </span>
                  <button
                    onClick={() => {
                      setAddToStageId(stage.id)
                      setShowAddMember(true)
                    }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition"
                    title="Add member to this stage"
                  >
                    <Plus className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                {/* Member Cards */}
                <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
                  {(stage.pipeline_members || []).map(pm => (
                    <MemberCard
                      key={pm.id}
                      pipelineMember={pm}
                      onDragStart={() => handleDragStart(pm.member_id)}
                      onRemove={() => removeMemberFromPipeline(pm.member_id)}
                    />
                  ))}

                  {/* Drop zone placeholder */}
                  {(stage.pipeline_members?.length || 0) === 0 && (
                    <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                      Drag members here or click + to add
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Pipeline Modal */}
      {showCreatePipeline && (
        <CreatePipelineModal
          name={newPipelineName}
          setName={setNewPipelineName}
          onCreate={createPipeline}
          onClose={() => setShowCreatePipeline(false)}
        />
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddMember(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Add Member to Pipeline</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => handleMemberSearch(e.target.value)}
                  onFocus={() => { if (!memberSearch.trim()) loadRecentMembers() }}
                  placeholder="Search members by name or email..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="mt-4 max-h-64 overflow-y-auto space-y-1">
                {searchLoading && (
                  <div className="text-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500 mx-auto" />
                  </div>
                )}
                {searchResults.map(member => (
                  <button
                    key={member.id}
                    onClick={() => addMemberToPipeline(member.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-left"
                  >
                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-500 dark:text-gray-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{member.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {member.email || member.group?.name || 'No email'}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      member.status === 'new' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
                      member.status === 'contacted' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                      member.status === 'qualified' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                      member.status === 'converted' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                      'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                    }`}>
                      {member.status}
                    </span>
                  </button>
                ))}
                {!searchLoading && searchResults.length === 0 && (
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
                    {memberSearch ? 'No members found' : 'No recent members available'}
                  </p>
                )}
              </div>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 flex justify-end">
              <button
                onClick={() => { setShowAddMember(false); setMemberSearch(''); setSearchResults([]) }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Pipeline Modal */}
      {showEditPipeline && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEditPipeline(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Edit Pipeline</h3>

              {/* Pipeline Name */}
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pipeline Name</label>
              <input
                type="text"
                value={editPipelineName}
                onChange={(e) => setEditPipelineName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
              />

              {/* Stages */}
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Stages</label>
                <button
                  onClick={addStageToEdit}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Stage
                </button>
              </div>

              <div className="space-y-2">
                {editStages.map((stage, idx) => (
                  <div key={stage.id} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                    <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <input
                      type="color"
                      value={stage.color}
                      onChange={(e) => {
                        const updated = [...editStages]
                        updated[idx] = { ...updated[idx], color: e.target.value }
                        setEditStages(updated)
                      }}
                      className="w-6 h-6 rounded border-0 cursor-pointer flex-shrink-0"
                    />
                    <input
                      type="text"
                      value={stage.name}
                      onChange={(e) => {
                        const updated = [...editStages]
                        updated[idx] = { ...updated[idx], name: e.target.value }
                        setEditStages(updated)
                      }}
                      className="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <select
                      value={stage.status_mapping || ''}
                      onChange={(e) => {
                        const updated = [...editStages]
                        updated[idx] = { ...updated[idx], status_mapping: (e.target.value || null) as MemberStatus | null }
                        setEditStages(updated)
                      }}
                      className="text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      title="Auto-sync with member status"
                    >
                      <option value="">No sync</option>
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => deleteStageFromEdit(stage.id)}
                      className="p-1 text-red-400 hover:text-red-600 transition flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Delete Pipeline */}
              <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    if (confirm('Delete this pipeline? Members will not be deleted.')) {
                      deletePipeline(activePipelineId!)
                      setShowEditPipeline(false)
                    }
                  }}
                  className="text-sm text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" /> Delete Pipeline
                </button>
              </div>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 flex justify-end gap-2">
              <button
                onClick={() => setShowEditPipeline(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={saveEditPipeline}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Member Card Component
function MemberCard({
  pipelineMember,
  onDragStart,
  onRemove,
}: {
  pipelineMember: PipelineMember
  onDragStart: () => void
  onRemove: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const member = pipelineMember.member

  if (!member) return null

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition group"
    >
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <Link
            href={`/dashboard/members/${member.id}`}
            className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition block truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {member.name}
          </Link>
          {member.email && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1 mt-0.5">
              <Mail className="w-3 h-3" />
              {member.email}
            </p>
          )}
        </div>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
          >
            <MoreHorizontal className="w-4 h-4 text-gray-400" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 py-1 w-40">
              <Link
                href={`/dashboard/members/${member.id}`}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View Member
              </Link>
              {member.fb_user_id && (
                <a
                  href={`https://www.facebook.com/messages/t/${member.fb_user_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Message
                </a>
              )}
              <button
                onClick={() => { onRemove(); setShowMenu(false) }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 w-full text-left"
              >
                <X className="w-3.5 h-3.5" /> Remove
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      {member.tags && member.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {member.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
          {member.tags.length > 3 && (
            <span className="text-xs text-gray-400">+{member.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Group name */}
      {member.group && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 truncate">
          {member.group.name}
        </p>
      )}
    </div>
  )
}

// Create Pipeline Modal Component
function CreatePipelineModal({
  name,
  setName,
  onCreate,
  onClose,
}: {
  name: string
  setName: (v: string) => void
  onCreate: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Create New Pipeline</h3>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pipeline Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sales Pipeline"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && onCreate()}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            4 default stages will be created: New Lead, Contacted, Qualified, Converted. You can customize them after.
          </p>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={onCreate}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
          >
            Create Pipeline
          </button>
        </div>
      </div>
    </div>
  )
}
