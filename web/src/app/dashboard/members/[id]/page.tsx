'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ExternalLink, Mail, Phone, Tag, Clock, User, MessageSquare,
  Loader2, Save, Trash2, X, Plus
} from 'lucide-react'
import type { Member, ActivityLog, MemberStatus } from '@/types/database'

type MemberWithGroup = Member & { group?: { id: string; name: string; fb_group_url: string | null } }

export default function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [member, setMember] = useState<MemberWithGroup | null>(null)
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Editable fields
  const [status, setStatus] = useState<MemberStatus>('new')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const statusColors = {
    new: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    contacted: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
    qualified: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
    converted: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    archived: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
  } as const

  const actionLabels: Record<string, string> = {
    member_approved: 'Member approved',
    status_changed: 'Status changed',
    tag_added: 'Tag added',
    tag_removed: 'Tag removed',
    note_added: 'Note updated',
    assigned: 'Assigned',
    exported: 'Exported',
    email_sent: 'Email sent',
    member_deleted: 'Member deleted',
  }

  useEffect(() => {
    async function loadMember() {
      try {
        const res = await fetch(`/api/members/${id}`)
        if (!res.ok) {
          router.push('/dashboard/members')
          return
        }
        const data = await res.json()
        setMember(data.member)
        setActivities(data.activities || [])

        // Set editable fields
        setStatus(data.member.status)
        setNotes(data.member.notes || '')
        setTags(data.member.tags || [])
        setEmail(data.member.email || '')
        setPhone(data.member.phone || '')
      } catch (err) {
        console.error('Error loading member:', err)
      } finally {
        setLoading(false)
      }
    }
    loadMember()
  }, [id, router])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes, tags, email, phone }),
      })
      if (res.ok) {
        const data = await res.json()
        setMember(data.member)
        // Reload activities
        const actRes = await fetch(`/api/members/${id}`)
        const actData = await actRes.json()
        setActivities(actData.activities || [])
      }
    } catch (err) {
      console.error('Error saving:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim().toLowerCase())) {
      setTags([...tags, newTag.trim().toLowerCase()])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove))
  }

  const handleDelete = async () => {
    if (!confirm('Delete this member? This cannot be undone.')) return
    await fetch(`/api/members/${id}`, { method: 'DELETE' })
    router.push('/dashboard/members')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!member) {
    return (
      <div className="text-center py-12">
        <p>Member not found.</p>
        <Link href="/dashboard/members" className="text-blue-600 hover:underline mt-2 inline-block">
          Back to Members
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back button */}
      <Link
        href="/dashboard/members"
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Members
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">{member.name}</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {member.group?.name || 'Unknown group'} &middot; Added {new Date(member.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <h2 className="text-lg font-bold">Contact Information</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  <Mail className="w-4 h-4 inline mr-1" /> Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="No email captured"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  <Phone className="w-4 h-4 inline mr-1" /> Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="No phone captured"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {member.fb_profile_url && (
              <div className="flex flex-wrap gap-4">
                <a
                  href={member.fb_profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Facebook Profile
                </a>
                <a
                  href={
                    member.fb_user_id
                      ? `https://www.facebook.com/messages/t/${member.fb_user_id}`
                      : `${member.fb_profile_url.replace(/\/$/, '')}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <MessageSquare className="w-4 h-4" />
                  Send Facebook Message
                </a>
              </div>
            )}
          </div>

          {/* Membership Answers */}
          {member.answers && (Array.isArray(member.answers) ? member.answers.length > 0 : false) && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-3">
              <h2 className="text-lg font-bold">Membership Answers</h2>
              <div className="space-y-2">
                {(member.answers as string[]).map((answer, i) => (
                  <div key={i} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm">
                    {typeof answer === 'string' ? answer : JSON.stringify(answer)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <MessageSquare className="w-5 h-5" /> Notes
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this member..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-3">
            <h2 className="text-lg font-bold">Status</h2>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as MemberStatus)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="converted">Converted</option>
              <option value="archived">Archived</option>
            </select>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>

          {/* Tags */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Tag className="w-5 h-5" /> Tags
            </h2>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded text-xs"
                >
                  {tag}
                  <button onClick={() => handleRemoveTag(tag)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {tags.length === 0 && (
                <span className="text-sm text-gray-500">No tags</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="Add tag..."
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddTag}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Clock className="w-5 h-5" /> Activity
            </h2>
            {activities.length === 0 ? (
              <p className="text-sm text-gray-500">No activity recorded yet.</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3 text-sm">
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 flex-shrink-0"></div>
                    <div>
                      <p className="font-medium">
                        {actionLabels[activity.action] || activity.action}
                      </p>
                      {activity.details && Object.keys(activity.details).length > 0 && (
                        <p className="text-gray-500 text-xs">
                          {activity.action === 'status_changed'
                            ? `${(activity.details as Record<string, string>).from} → ${(activity.details as Record<string, string>).to}`
                            : JSON.stringify(activity.details)}
                        </p>
                      )}
                      <p className="text-gray-400 text-xs">
                        {new Date(activity.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
