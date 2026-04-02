'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Link,
  Zap,
  Mail,
  Webhook,
  CheckCircle,
  ExternalLink,
  Loader2,
  Plus,
  Trash2,
  TestTube,
  AlertCircle,
  X,
} from 'lucide-react'

interface Integration {
  id: string
  group_id: string
  type: string
  config: Record<string, unknown>
  active: boolean
  last_synced_at: string | null
  created_at: string
  group?: { id: string; name: string }
}

interface Group {
  id: string
  name: string
}

const INTEGRATION_META = {
  webhook: {
    name: 'Webhooks',
    description: 'Send real-time member events to your own servers',
    icon: Webhook,
    color: 'bg-purple-100 dark:bg-purple-900',
    iconColor: 'text-purple-600 dark:text-purple-400',
    configFields: [
      { key: 'url', label: 'Webhook URL', type: 'url', placeholder: 'https://your-server.com/webhook', required: true },
      { key: 'secret', label: 'Signing Secret (optional)', type: 'text', placeholder: 'whsec_...', required: false },
    ],
  },
  gohighlevel: {
    name: 'GoHighLevel',
    description: 'Sync members as contacts in your GoHighLevel CRM',
    icon: Link,
    color: 'bg-blue-100 dark:bg-blue-900',
    iconColor: 'text-blue-600 dark:text-blue-400',
    configFields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'Your GHL API key', required: true },
      { key: 'location_id', label: 'Location ID', type: 'text', placeholder: 'Your GHL location ID', required: true },
      { key: 'tag', label: 'Default Tag (optional)', type: 'text', placeholder: 'e.g. facebook-lead', required: false },
    ],
  },
  mailchimp: {
    name: 'Mailchimp',
    description: 'Sync members to your Mailchimp audience automatically',
    icon: Mail,
    color: 'bg-yellow-100 dark:bg-yellow-900',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    configFields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'Your Mailchimp API key (key-dc)', required: true },
      { key: 'audience_id', label: 'Audience/List ID', type: 'text', placeholder: 'Your Mailchimp audience ID', required: true },
      { key: 'tag', label: 'Default Tag (optional)', type: 'text', placeholder: 'e.g. facebook-group', required: false },
    ],
  },
  zapier: {
    name: 'Zapier',
    description: 'Connect GroupBase to 5,000+ apps via Zapier webhooks',
    icon: Zap,
    color: 'bg-orange-100 dark:bg-orange-900',
    iconColor: 'text-orange-600 dark:text-orange-400',
    configFields: [
      { key: 'url', label: 'Zapier Webhook URL', type: 'url', placeholder: 'https://hooks.zapier.com/hooks/catch/...', required: true },
    ],
  },
} as const

type IntegrationType = keyof typeof INTEGRATION_META

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addType, setAddType] = useState<IntegrationType | null>(null)
  const [addGroupId, setAddGroupId] = useState('')
  const [addConfig, setAddConfig] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [intResponse, groupResponse] = await Promise.all([
        fetch('/api/integrations'),
        fetch('/api/groups'),
      ])
      const intData = await intResponse.json()
      const groupData = await groupResponse.json()
      setIntegrations(intData.integrations || [])
      setGroups(groupData.groups || [])
    } catch (error) {
      console.error('Error loading integrations:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd() {
    if (!addType || !addGroupId) return
    setSaving(true)

    try {
      const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: addGroupId,
          type: addType,
          config: addConfig,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to create integration' })
        return
      }

      setMessage({ type: 'success', text: `${INTEGRATION_META[addType].name} integration added!` })
      setShowAddModal(false)
      setAddType(null)
      setAddConfig({})
      loadData()
    } catch (error) {
      console.error('Error creating integration:', error)
      setMessage({ type: 'error', text: 'Something went wrong' })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(integration: Integration) {
    try {
      await fetch(`/api/integrations/${integration.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !integration.active }),
      })
      loadData()
    } catch (error) {
      console.error('Error toggling integration:', error)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this integration?')) return

    try {
      await fetch(`/api/integrations/${id}`, { method: 'DELETE' })
      setMessage({ type: 'success', text: 'Integration deleted' })
      loadData()
    } catch (error) {
      console.error('Error deleting integration:', error)
    }
  }

  async function handleTest(id: string) {
    setTesting(id)
    try {
      const response = await fetch(`/api/integrations/${id}/test`, { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        setMessage({
          type: 'success',
          text: data.message || `Test webhook sent! Status: ${data.statusCode} (${data.duration}ms)`,
        })
      } else {
        setMessage({
          type: 'error',
          text: `Test failed: ${data.error || `Status ${data.statusCode}`}`,
        })
      }
    } catch (error) {
      console.error('Error testing integration:', error)
      setMessage({ type: 'error', text: 'Test request failed' })
    } finally {
      setTesting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Integrations</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Connect GroupBase with your favorite tools
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          Add Integration
        </button>
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <p className="text-sm">{message.text}</p>
          <button onClick={() => setMessage(null)} className="ml-auto text-sm underline opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Active Integrations */}
      {integrations.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Webhook className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No integrations yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Add an integration to automatically sync new members to your tools.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            Add your first integration
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {integrations.map((integration) => {
            const meta = INTEGRATION_META[integration.type as IntegrationType]
            if (!meta) return null
            const Icon = meta.icon

            return (
              <div
                key={integration.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`${meta.color} p-3 rounded-lg`}>
                      <Icon className={`w-6 h-6 ${meta.iconColor}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{meta.name}</h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            integration.active
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          }`}
                        >
                          {integration.active ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        Group: {integration.group?.name || 'Unknown'}
                      </p>
                      {integration.last_synced_at && (
                        <p className="text-xs text-gray-400 mt-1">
                          Last synced: {new Date(integration.last_synced_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {(integration.type === 'webhook' || integration.type === 'zapier') && (
                      <button
                        onClick={() => handleTest(integration.id)}
                        disabled={testing === integration.id}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition text-gray-500"
                        title="Send test event"
                      >
                        {testing === integration.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <TestTube className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleToggle(integration)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        integration.active
                          ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400'
                          : 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400'
                      }`}
                    >
                      {integration.active ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={() => handleDelete(integration.id)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition text-red-500"
                      title="Delete integration"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Integration Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {addType ? `Add ${INTEGRATION_META[addType].name}` : 'Choose Integration'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setAddType(null)
                  setAddConfig({})
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {!addType ? (
                <div className="grid grid-cols-2 gap-4">
                  {(Object.keys(INTEGRATION_META) as IntegrationType[]).map((type) => {
                    const meta = INTEGRATION_META[type]
                    const Icon = meta.icon
                    return (
                      <button
                        key={type}
                        onClick={() => setAddType(type)}
                        className="flex flex-col items-center gap-3 p-6 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                      >
                        <div className={`${meta.color} p-3 rounded-lg`}>
                          <Icon className={`w-6 h-6 ${meta.iconColor}`} />
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">{meta.name}</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Group selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Group
                    </label>
                    <select
                      value={addGroupId}
                      onChange={(e) => setAddGroupId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Select a group...</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Config fields */}
                  {INTEGRATION_META[addType].configFields.map((field) => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        {field.label}
                      </label>
                      <input
                        type={field.type}
                        placeholder={field.placeholder}
                        value={addConfig[field.key] || ''}
                        onChange={(e) => setAddConfig({ ...addConfig, [field.key]: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                      />
                    </div>
                  ))}

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => {
                        setAddType(null)
                        setAddConfig({})
                      }}
                      className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleAdd}
                      disabled={saving || !addGroupId}
                      className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                      Save Integration
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
