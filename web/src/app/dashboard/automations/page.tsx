'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Zap,
  Plus,
  Play,
  Pause,
  Trash2,
  Mail,
  Tag,
  ArrowRight,
  Globe,
  Clock,
  Loader2,
  X,
} from 'lucide-react'

interface AutomationAction {
  type: 'add_tag' | 'set_status' | 'send_email' | 'webhook' | 'wait'
  config: Record<string, any>
}

interface Automation {
  id: string
  group_id: string
  name: string
  trigger: 'member.created' | 'member.status_changed'
  active: boolean
  actions: AutomationAction[]
  created_at: string
  updated_at: string
}

interface Group {
  id: string
  name: string
}

const ACTION_TYPES = [
  {
    type: 'add_tag',
    label: 'Add Tag',
    icon: Tag,
    description: 'Add a tag to the member',
  },
  {
    type: 'set_status',
    label: 'Change Status',
    icon: ArrowRight,
    description: 'Set member status',
  },
  {
    type: 'send_email',
    label: 'Send Email',
    icon: Mail,
    description: 'Send welcome email with variables',
  },
  {
    type: 'webhook',
    label: 'Call Webhook',
    icon: Globe,
    description: 'Send webhook to external service',
  },
  {
    type: 'wait',
    label: 'Wait',
    icon: Clock,
    description: 'Delay before next action',
  },
]

const TRIGGER_OPTIONS = [
  { value: 'member.created', label: 'When member is approved' },
  { value: 'member.status_changed', label: 'When status changes' },
]

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    group_id: '',
    trigger: 'member.created',
    actions: [] as AutomationAction[],
  })
  const [actionTypeToAdd, setActionTypeToAdd] = useState<string | null>(null)
  const [newActionConfig, setNewActionConfig] = useState<Record<string, unknown>>({})

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)

      // Load groups
      const { data: groupsData } = await supabase
        .from('groups')
        .select('id, name')
        .order('name')

      setGroups(groupsData || [])

      // Load automations
      if (groupsData && groupsData.length > 0) {
        const { data: automationsData } = await supabase.from('integrations').select('*').eq('type', 'automation')

        const parsed = (automationsData || []).map((int: any) => ({
          id: int.id,
          group_id: int.group_id,
          name: int.name,
          trigger: int.config?.trigger || 'member.created',
          active: int.active,
          actions: int.config?.actions || [],
          created_at: int.created_at,
          updated_at: int.updated_at,
        }))

        setAutomations(parsed)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  function openModal(automation?: Automation) {
    if (automation) {
      setEditingAutomation(automation)
      setFormData({
        name: automation.name,
        group_id: automation.group_id,
        trigger: automation.trigger,
        actions: automation.actions,
      })
    } else {
      setEditingAutomation(null)
      setFormData({
        name: '',
        group_id: groups[0]?.id || '',
        trigger: 'member.created',
        actions: [],
      })
    }
    setActionTypeToAdd(null)
    setNewActionConfig({})
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingAutomation(null)
    setFormData({
      name: '',
      group_id: '',
      trigger: 'member.created',
      actions: [],
    })
    setActionTypeToAdd(null)
    setNewActionConfig({})
  }

  function addAction() {
    if (!actionTypeToAdd) return

    const newAction: AutomationAction = {
      type: actionTypeToAdd as AutomationAction['type'],
      config: newActionConfig,
    }

    setFormData({
      ...formData,
      actions: [...formData.actions, newAction],
    })

    setActionTypeToAdd(null)
    setNewActionConfig({})
  }

  function removeAction(index: number) {
    setFormData({
      ...formData,
      actions: formData.actions.filter((_, i) => i !== index),
    })
  }

  function updateActionConfig(key: string, value: unknown) {
    setNewActionConfig({
      ...newActionConfig,
      [key]: value,
    })
  }

  async function saveAutomation() {
    if (!formData.name || !formData.group_id) {
      alert('Please fill in all required fields')
      return
    }

    try {
      if (editingAutomation) {
        const response = await fetch(`/api/automations/${editingAutomation.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            trigger: formData.trigger,
            actions: formData.actions,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          alert(`Error: ${error.error}`)
          return
        }

        const { automation } = await response.json()
        setAutomations(automations.map((a) => (a.id === automation.id ? automation : a)))
      } else {
        const response = await fetch('/api/automations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })

        if (!response.ok) {
          const error = await response.json()
          alert(`Error: ${error.error}`)
          return
        }

        const { automation } = await response.json()
        setAutomations([...automations, automation])
      }

      closeModal()
    } catch (error) {
      console.error('Error saving automation:', error)
      alert('Failed to save automation')
    }
  }

  async function toggleAutomation(automation: Automation) {
    try {
      const response = await fetch(`/api/automations/${automation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !automation.active }),
      })

      if (!response.ok) throw new Error('Failed to update')

      const { automation: updated } = await response.json()
      setAutomations(automations.map((a) => (a.id === updated.id ? updated : a)))
    } catch (error) {
      console.error('Error toggling automation:', error)
      alert('Failed to toggle automation')
    }
  }

  async function deleteAutomation(automation: Automation) {
    if (!confirm(`Delete automation "${automation.name}"?`)) return

    try {
      const response = await fetch(`/api/automations/${automation.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete')

      setAutomations(automations.filter((a) => a.id !== automation.id))
    } catch (error) {
      console.error('Error deleting automation:', error)
      alert('Failed to delete automation')
    }
  }

  const getGroupName = (groupId: string) => {
    return groups.find((g) => g.id === groupId)?.name || 'Unknown'
  }

  const getTriggerLabel = (trigger: string) => {
    return TRIGGER_OPTIONS.find((t) => t.value === trigger)?.label || trigger
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Zap className="w-8 h-8 text-amber-400" />
              Automations
            </h1>
            <p className="text-slate-400 mt-1">
              Set up automated actions when members are approved or status changes
            </p>
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Automation
          </button>
        </div>

        {/* Automations List */}
        {automations.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
            <Zap className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No automations yet</h3>
            <p className="text-slate-400 mb-6">
              Create your first automation to automatically perform actions when members are
              approved or status changes
            </p>
            <button
              onClick={() => openModal()}
              className="bg-indigo-600 hover:bg-indigo-700 px-6 py-2 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Set up your first automation
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {automations.map((automation) => (
              <div
                key={automation.id}
                className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{automation.name}</h3>
                    <p className="text-sm text-slate-400">
                      Group: {getGroupName(automation.group_id)} • Trigger:{' '}
                      {getTriggerLabel(automation.trigger)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAutomation(automation)}
                      className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                      title={automation.active ? 'Disable' : 'Enable'}
                    >
                      {automation.active ? (
                        <Play className="w-5 h-5 text-green-400" />
                      ) : (
                        <Pause className="w-5 h-5 text-slate-600" />
                      )}
                    </button>

                    <button
                      onClick={() => openModal(automation)}
                      className="px-3 py-1 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => deleteAutomation(automation)}
                      className="p-2 rounded-lg hover:bg-red-900/20 text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Actions Pipeline */}
                {automation.actions.length > 0 && (
                  <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <p className="text-xs font-semibold text-slate-400 uppercase mb-3">
                      Actions ({automation.actions.length})
                    </p>
                    <div className="space-y-2">
                      {automation.actions.map((action, idx) => {
                        const actionType = ACTION_TYPES.find((t) => t.type === action.type)
                        const Icon = actionType?.icon || Zap

                        return (
                          <div key={idx} className="flex items-center gap-3 text-sm">
                            <Icon className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                            <div className="flex-1">
                              <span className="font-medium">{actionType?.label}</span>
                              {action.config.tag && (
                                <span className="ml-2 text-slate-400">
                                  — tag: {String(action.config.tag)}
                                </span>
                              )}
                              {action.config.status && (
                                <span className="ml-2 text-slate-400">
                                  — status: {String(action.config.status)}
                                </span>
                              )}
                              {action.config.delay_minutes && (
                                <span className="ml-2 text-slate-400">
                                  — {String(action.config.delay_minutes)}m
                                </span>
                              )}
                            </div>
                            {idx < automation.actions.length - 1 && (
                              <ArrowRight className="w-4 h-4 text-slate-600" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <p className="text-xs text-slate-500 mt-4">
                  Created {new Date(automation.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-800 sticky top-0 bg-slate-900">
              <h2 className="text-xl font-bold">
                {editingAutomation ? 'Edit Automation' : 'Create Automation'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div>
                <label className="block text-sm font-medium mb-2">Automation Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Welcome New Members"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Group Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Group *</label>
                <select
                  value={formData.group_id}
                  onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Select a group</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Trigger */}
              <div>
                <label className="block text-sm font-medium mb-2">Trigger</label>
                <select
                  value={formData.trigger}
                  onChange={(e) => setFormData({ ...formData, trigger: e.target.value as any })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
                >
                  {TRIGGER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div>
                <label className="block text-sm font-medium mb-3">Actions</label>

                {formData.actions.length > 0 && (
                  <div className="mb-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700 space-y-3">
                    {formData.actions.map((action, idx) => {
                      const actionType = ACTION_TYPES.find((t) => t.type === action.type)

                      return (
                        <div key={idx} className="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{actionType?.label}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {JSON.stringify(action.config)}
                            </p>
                          </div>
                          <button
                            onClick={() => removeAction(idx)}
                            className="ml-2 p-1 hover:bg-red-900/20 text-red-400 rounded transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Add Action */}
                {!actionTypeToAdd ? (
                  <button
                    onClick={() => setActionTypeToAdd('add_tag')}
                    className="w-full p-3 border-2 border-dashed border-slate-700 rounded-lg hover:border-slate-600 transition-colors text-slate-300 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Action
                  </button>
                ) : (
                  <div className="border border-slate-700 rounded-lg p-4 bg-slate-800/50">
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">Action Type</label>
                      <select
                        value={actionTypeToAdd}
                        onChange={(e) => {
                          setActionTypeToAdd(e.target.value)
                          setNewActionConfig({})
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
                      >
                        {ACTION_TYPES.map((t) => (
                          <option key={t.type} value={t.type}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Action-specific config */}
                    {actionTypeToAdd === 'add_tag' && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Tag Name</label>
                        <input
                          type="text"
                          value={(newActionConfig.tag as string) || ''}
                          onChange={(e) => updateActionConfig('tag', e.target.value)}
                          placeholder="e.g., new-member"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {actionTypeToAdd === 'set_status' && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Status</label>
                        <input
                          type="text"
                          value={(newActionConfig.status as string) || ''}
                          onChange={(e) => updateActionConfig('status', e.target.value)}
                          placeholder="e.g., contacted"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {actionTypeToAdd === 'send_email' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-2">Subject</label>
                          <input
                            type="text"
                            value={(newActionConfig.subject as string) || ''}
                            onChange={(e) => updateActionConfig('subject', e.target.value)}
                            placeholder="Welcome {{name}}"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Body (HTML)</label>
                          <textarea
                            value={(newActionConfig.body as string) || ''}
                            onChange={(e) => updateActionConfig('body', e.target.value)}
                            placeholder="Welcome {{name}}! Your email is {{email}}."
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none text-sm h-24"
                          />
                          <p className="text-xs text-slate-400 mt-1">
                            Variables: {'{'}
                            {'}'}name, {'{'}
                            {'}'}email, {'{'}
                            {'}'}phone, {'{'}
                            {'}'}status
                          </p>
                        </div>
                      </div>
                    )}

                    {actionTypeToAdd === 'webhook' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-2">Webhook URL</label>
                          <input
                            type="url"
                            value={(newActionConfig.url as string) || ''}
                            onChange={(e) => updateActionConfig('url', e.target.value)}
                            placeholder="https://example.com/webhook"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Secret (optional)</label>
                          <input
                            type="text"
                            value={(newActionConfig.secret as string) || ''}
                            onChange={(e) => updateActionConfig('secret', e.target.value)}
                            placeholder="Webhook secret for HMAC signing"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {actionTypeToAdd === 'wait' && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Delay (minutes)</label>
                        <input
                          type="number"
                          value={(newActionConfig.delay_minutes as number) || 0}
                          onChange={(e) => updateActionConfig('delay_minutes', parseInt(e.target.value))}
                          placeholder="60"
                          min="0"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none text-sm"
                        />
                      </div>
                    )}

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={addAction}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Add Action
                      </button>
                      <button
                        onClick={() => {
                          setActionTypeToAdd(null)
                          setNewActionConfig({})
                        }}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-800 p-6 flex gap-3 justify-end sticky bottom-0 bg-slate-900">
              <button
                onClick={closeModal}
                className="px-6 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveAutomation}
                className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-medium transition-colors"
              >
                {editingAutomation ? 'Update Automation' : 'Create Automation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
