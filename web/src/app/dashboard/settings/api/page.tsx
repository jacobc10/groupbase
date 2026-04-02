'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Copy,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Check,
  Trash2,
  Code2,
  Zap,
} from 'lucide-react'

interface ApiKeyStatus {
  has_key: boolean
  created_at: string | null
}

export default function ApiKeyPage() {
  const [status, setStatus] = useState<ApiKeyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [revokeConfirm, setRevokeConfirm] = useState(false)

  // Load API key status
  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus() {
    try {
      const response = await fetch('/api/settings/api-key', {
        method: 'GET',
      })
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error('Error loading API key status:', error)
      setMessage({ type: 'error', text: 'Failed to load API key status' })
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateKey() {
    setGenerating(true)
    setMessage(null)
    try {
      const response = await fetch('/api/settings/api-key', {
        method: 'POST',
      })
      const data = await response.json()

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to generate API key' })
        return
      }

      setApiKey(data.api_key)
      setStatus({ has_key: true, created_at: new Date().toISOString() })
      setMessage({ type: 'success', text: 'API key generated successfully' })
    } catch (error) {
      console.error('Error generating API key:', error)
      setMessage({ type: 'error', text: 'Failed to generate API key' })
    } finally {
      setGenerating(false)
    }
  }

  async function handleRevokeKey() {
    setRevoking(true)
    setMessage(null)
    try {
      const response = await fetch('/api/settings/api-key', {
        method: 'DELETE',
      })
      const data = await response.json()

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to revoke API key' })
        return
      }

      setApiKey(null)
      setStatus({ has_key: false, created_at: null })
      setRevokeConfirm(false)
      setMessage({ type: 'success', text: 'API key revoked' })
    } catch (error) {
      console.error('Error revoking API key:', error)
      setMessage({ type: 'error', text: 'Failed to revoke API key' })
    } finally {
      setRevoking(false)
    }
  }

  function handleCopyKey() {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey)
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
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
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">API Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage API keys for third-party integrations
        </p>
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <p className="text-sm">{message.text}</p>
          <button
            onClick={() => setMessage(null)}
            className="ml-auto text-sm underline opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* API Key Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Code2 className="w-5 h-5 text-indigo-600" />
          API Key
        </h2>

        {!status?.has_key && !apiKey ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Generate an API key to enable third-party integrations and programmatic access to your groups and members.
            </p>
            <button
              onClick={handleGenerateKey}
              disabled={generating}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-lg transition disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              Generate API Key
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {apiKey && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-start gap-3 mb-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-gray-900 dark:text-white">Save your API key now</p>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      This key will only be shown once. If you lose it, you'll need to generate a new one.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono text-gray-900 dark:text-white cursor-pointer"
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
                    title={showKey ? 'Hide' : 'Show'}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleCopyKey}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
                    title="Copy to clipboard"
                  >
                    {copiedKey ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {status?.has_key && !apiKey && (
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    API Key Active
                  </p>
                  {status.created_at && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Created {new Date(status.created_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">
                    Active
                  </span>
                </div>
              </div>
            )}

            {(status?.has_key || apiKey) && (
              <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                {apiKey && (
                  <button
                    onClick={() => {
                      setApiKey(null)
                      setShowKey(false)
                    }}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
                  >
                    Close
                  </button>
                )}
                <button
                  onClick={() => setRevokeConfirm(!revokeConfirm)}
                  className="ml-auto inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                  Revoke Key
                </button>
              </div>
            )}

            {revokeConfirm && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-3">
                  Are you sure? This will immediately revoke access for all integrations using this key.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleRevokeKey}
                    disabled={revoking}
                    className="px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {revoking ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Revoke
                  </button>
                  <button
                    onClick={() => setRevokeConfirm(false)}
                    className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* API Documentation Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-600" />
          API Documentation
        </h2>

        <div className="space-y-6">
          {/* Endpoints */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Available Endpoints
            </h3>
            <div className="space-y-3">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block px-2 py-1 text-xs font-semibold text-white bg-green-600 rounded">
                    GET
                  </span>
                  <code className="text-sm font-mono text-gray-900 dark:text-white">
                    /api/v1/groups
                  </code>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  List all your groups
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block px-2 py-1 text-xs font-semibold text-white bg-green-600 rounded">
                    GET
                  </span>
                  <code className="text-sm font-mono text-gray-900 dark:text-white">
                    /api/v1/members
                  </code>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  List members in a group
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
                  Query: group_id, status, search, limit (max 100), offset
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block px-2 py-1 text-xs font-semibold text-white bg-blue-600 rounded">
                    POST
                  </span>
                  <code className="text-sm font-mono text-gray-900 dark:text-white">
                    /api/v1/members
                  </code>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Create a new member
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
                  Body: group_id, name, email, phone, tags, status, notes
                </p>
              </div>
            </div>
          </div>

          {/* Example Request */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Example Request
            </h3>
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-xs font-mono text-gray-100">
{`curl -X GET https://groupbase.app/api/v1/groups \\
  -H "Authorization: Bearer gb_live_..." \\
  -H "Content-Type: application/json"`}
              </pre>
            </div>
          </div>

          {/* Rate Limits */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Rate Limits
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
                  Pro Plan
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  1,000 requests/day
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
                  Enterprise Plan
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Unlimited
                </p>
              </div>
            </div>
          </div>

          {/* Authentication */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Authentication
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Include your API key in the Authorization header as a Bearer token:
            </p>
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-xs font-mono text-gray-100">
{`Authorization: Bearer gb_live_your_api_key_here`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Stats Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Usage Stats
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">
              API Requests Today
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">—</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Coming soon
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">
              API Requests This Month
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">—</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Coming soon
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">
              Last Request
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">—</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Coming soon
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
