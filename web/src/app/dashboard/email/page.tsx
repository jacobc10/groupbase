'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Mail,
  Send,
  Users,
  FileText,
  Search,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'

interface Member {
  id: string
  name: string
  email: string | null
}

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
}

interface ActivityEntry {
  id: string
  action: string
  member_id: string
  created_at: string
  metadata?: {
    subject?: string
  }
}

interface SendResult {
  sent: number
  skipped: number
  failed: number
  errors: Array<{ to: string; error: string }>
  success: boolean
}

export default function EmailPage() {
  // Form state
  const [selectedMembers, setSelectedMembers] = useState<Member[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')

  // UI state
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [searchResults, setSearchResults] = useState<Member[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>([])

  // Loading/status state
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingTemplates, setIsFetchingTemplates] = useState(true)
  const [isFetchingActivity, setIsFetchingActivity] = useState(true)
  const [sendStatus, setSendStatus] = useState<SendResult | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates()
  }, [])

  // Fetch activity on mount
  useEffect(() => {
    fetchRecentActivity()
  }, [])

  const fetchTemplates = async () => {
    try {
      setIsFetchingTemplates(true)
      const response = await fetch('/api/email/templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      } else {
        console.error('Failed to fetch templates')
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setIsFetchingTemplates(false)
    }
  }

  const fetchRecentActivity = async () => {
    try {
      setIsFetchingActivity(true)
      const response = await fetch('/api/activity?action=email_sent&limit=10')
      if (response.ok) {
        const data = await response.json()
        setRecentActivity(data.activity || [])
      } else {
        console.error('Failed to fetch activity')
      }
    } catch (error) {
      console.error('Error fetching activity:', error)
    } finally {
      setIsFetchingActivity(false)
    }
  }

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query)

      if (!query.trim()) {
        setSearchResults([])
        return
      }

      try {
        const response = await fetch(`/api/members?search=${encodeURIComponent(query)}`)
        if (response.ok) {
          const data = await response.json()
          setSearchResults(data.members || [])
        }
      } catch (error) {
        console.error('Error searching members:', error)
      }
    },
    []
  )

  const handleAddMember = (member: Member) => {
    if (!selectedMembers.find((m) => m.id === member.id)) {
      setSelectedMembers([...selectedMembers, member])
    }
    setSearchQuery('')
    setSearchResults([])
  }

  const handleRemoveMember = (memberId: string) => {
    setSelectedMembers(selectedMembers.filter((m) => m.id !== memberId))
  }

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId)
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      setSubject(template.subject)
      setBody(template.body)
    }
  }

  const handleSendEmail = async () => {
    if (!selectedMembers.length) {
      alert('Please select at least one member')
      return
    }

    if (!subject.trim()) {
      alert('Please enter a subject')
      return
    }

    if (!body.trim()) {
      alert('Please enter an email body')
      return
    }

    setIsLoading(true)
    setSendStatus(null)

    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_ids: selectedMembers.map((m) => m.id),
          subject,
          body,
          template_id: selectedTemplate || undefined,
        }),
      })

      const data = (await response.json()) as SendResult
      setSendStatus(data)

      if (data.success) {
        setShowSuccess(true)
        setTimeout(() => {
          setShowSuccess(false)
        }, 5000)

        // Reset form
        setSelectedMembers([])
        setSubject('')
        setBody('')
        setSelectedTemplate('')

        // Refresh activity
        fetchRecentActivity()
      }
    } catch (error) {
      console.error('Error sending email:', error)
      setSendStatus({
        sent: 0,
        skipped: 0,
        failed: selectedMembers.length,
        errors: [
          {
            to: 'all',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
        success: false,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Mail className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold text-white">Email Outreach</h1>
          </div>
          <p className="text-slate-400">Send targeted emails to your group members</p>
        </div>

        {/* Success Message */}
        {showSuccess && sendStatus?.success && (
          <div className="mb-6 p-4 bg-emerald-900/30 border border-emerald-500 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-emerald-200 font-semibold mb-1">Emails sent successfully</h3>
              <p className="text-emerald-300 text-sm">
                {sendStatus.sent} email{sendStatus.sent !== 1 ? 's' : ''} sent
                {sendStatus.skipped > 0 && `, ${sendStatus.skipped} skipped`}
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {sendStatus && !sendStatus.success && sendStatus.failed > 0 && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-red-200 font-semibold mb-2">Some emails failed to send</h3>
              {sendStatus.errors.length > 0 && (
                <ul className="text-red-300 text-sm space-y-1">
                  {sendStatus.errors.slice(0, 3).map((err, i) => (
                    <li key={i}>
                      {err.to}: {err.error}
                    </li>
                  ))}
                  {sendStatus.errors.length > 3 && <li>...and {sendStatus.errors.length - 3} more</li>}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Compose Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Template Selector */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Email Template
              </h2>

              {isFetchingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                </div>
              ) : (
                <select
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white mb-4 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Choose a template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Compose Form */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Mail className="w-5 h-5 text-blue-400" />
                Compose Email
              </h2>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject..."
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Body</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Email body... Use {{name}}, {{email}}, {{group_name}} for personalization"
                  rows={10}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Template Variables Info */}
              <div className="bg-slate-700/50 border border-slate-600 rounded p-3">
                <p className="text-xs font-medium text-slate-300 mb-2">Available variables:</p>
                <div className="flex flex-wrap gap-2">
                  {['{{name}}', '{{email}}', '{{group_name}}'].map((variable) => (
                    <code
                      key={variable}
                      className="bg-slate-800 text-blue-300 px-2 py-1 rounded text-xs font-mono"
                    >
                      {variable}
                    </code>
                  ))}
                </div>
              </div>

              {/* Send Button */}
              <button
                onClick={handleSendEmail}
                disabled={isLoading || !selectedMembers.length || !subject.trim() || !body.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sidebar: Recipient Selection */}
          <div className="space-y-6">
            {/* Search Recipients */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Recipients
              </h2>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search members..."
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 pl-9 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Search Results */}
              {searchQuery && searchResults.length > 0 && (
                <div className="bg-slate-700/50 rounded border border-slate-600 mb-4 max-h-48 overflow-y-auto">
                  {searchResults.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => handleAddMember(member)}
                      disabled={selectedMembers.find((m) => m.id === member.id) !== undefined}
                      className="w-full text-left px-3 py-2 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed border-b border-slate-600 last:border-b-0 transition-colors"
                    >
                      <div className="font-medium text-slate-200">{member.name}</div>
                      {member.email && <div className="text-xs text-slate-400">{member.email}</div>}
                    </button>
                  ))}
                </div>
              )}

              {/* Quick Filters */}
              <div className="space-y-2 mb-4">
                <p className="text-xs font-medium text-slate-400 uppercase">Quick filters</p>
                <button className="w-full text-left px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded border border-slate-600 text-slate-300 text-sm transition-colors">
                  All New Members
                </button>
                <button className="w-full text-left px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded border border-slate-600 text-slate-300 text-sm transition-colors">
                  All Contacted
                </button>
                <button className="w-full text-left px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded border border-slate-600 text-slate-300 text-sm transition-colors">
                  All Qualified
                </button>
              </div>

              {/* Selected Recipients Pills */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-400 uppercase">
                  Selected ({selectedMembers.length})
                </p>
                {selectedMembers.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No recipients selected</p>
                ) : (
                  <div className="space-y-2">
                    {selectedMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between bg-slate-700 rounded px-3 py-2"
                      >
                        <span className="text-sm text-slate-200">{member.name}</span>
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Send History */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>

              {isFetchingActivity ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                </div>
              ) : recentActivity.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No email activity yet</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {recentActivity.map((entry) => (
                    <div key={entry.id} className="bg-slate-700/50 rounded p-3 border border-slate-600">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-xs font-medium text-blue-300 bg-blue-900/30 px-2 py-1 rounded">
                          {entry.action}
                        </span>
                      </div>
                      {entry.metadata?.subject && (
                        <p className="text-sm text-slate-300 truncate">{entry.metadata.subject}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(entry.created_at).toLocaleDateString()} at{' '}
                        {new Date(entry.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
