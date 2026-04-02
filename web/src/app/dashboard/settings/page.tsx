'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  CreditCard,
  Check,
  Crown,
  Loader2,
  ExternalLink,
  Sparkles,
  Shield,
  AlertCircle,
  User,
  Lock,
  Trash2,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react'

const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    features: [
      '1 Facebook Group',
      'Up to 100 members',
      'Basic member management',
      'Chrome extension capture',
      'Member search & filter',
    ],
  },
  pro: {
    name: 'Pro',
    price: 47,
    features: [
      'Up to 3 Facebook Groups',
      'Unlimited members',
      'CSV export & import',
      'Webhook integrations',
      'Tags & bulk actions',
      'Priority support',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    price: 97,
    features: [
      'Unlimited Facebook Groups',
      'Unlimited members',
      'All integrations',
      'Team management & roles',
      'CSV export & import',
      'White-glove onboarding',
      'Dedicated support',
    ],
  },
} as const

type PlanKey = keyof typeof PLANS

const TIMEZONES = [
  { label: '(UTC-12:00) International Date Line West', value: 'Etc/GMT+12' },
  { label: '(UTC-11:00) Coordinated Universal Time-11', value: 'Etc/GMT+11' },
  { label: '(UTC-10:00) Hawaii', value: 'Pacific/Honolulu' },
  { label: '(UTC-09:00) Alaska', value: 'America/Anchorage' },
  { label: '(UTC-08:00) Pacific Time (US & Canada)', value: 'America/Los_Angeles' },
  { label: '(UTC-07:00) Mountain Time (US & Canada)', value: 'America/Denver' },
  { label: '(UTC-07:00) Arizona', value: 'America/Phoenix' },
  { label: '(UTC-06:00) Central Time (US & Canada)', value: 'America/Chicago' },
  { label: '(UTC-05:00) Eastern Time (US & Canada)', value: 'America/New_York' },
  { label: '(UTC-05:00) Indiana (East)', value: 'America/Indiana/Indianapolis' },
  { label: '(UTC-04:00) Atlantic Time (Canada)', value: 'America/Halifax' },
  { label: '(UTC-03:30) Newfoundland', value: 'America/St_Johns' },
  { label: '(UTC-03:00) Buenos Aires', value: 'America/Argentina/Buenos_Aires' },
  { label: '(UTC+00:00) London, Dublin, Lisbon', value: 'Europe/London' },
  { label: '(UTC+01:00) Berlin, Paris, Rome, Madrid', value: 'Europe/Berlin' },
  { label: '(UTC+02:00) Athens, Helsinki, Istanbul', value: 'Europe/Athens' },
  { label: '(UTC+03:00) Moscow, Kuwait, Riyadh', value: 'Europe/Moscow' },
  { label: '(UTC+04:00) Abu Dhabi, Muscat', value: 'Asia/Dubai' },
  { label: '(UTC+05:00) Islamabad, Karachi', value: 'Asia/Karachi' },
  { label: '(UTC+05:30) Chennai, Kolkata, Mumbai', value: 'Asia/Kolkata' },
  { label: '(UTC+06:00) Dhaka', value: 'Asia/Dhaka' },
  { label: '(UTC+07:00) Bangkok, Hanoi, Jakarta', value: 'Asia/Bangkok' },
  { label: '(UTC+08:00) Beijing, Hong Kong, Singapore', value: 'Asia/Shanghai' },
  { label: '(UTC+09:00) Tokyo, Seoul', value: 'Asia/Tokyo' },
  { label: '(UTC+09:30) Adelaide', value: 'Australia/Adelaide' },
  { label: '(UTC+10:00) Sydney, Melbourne', value: 'Australia/Sydney' },
  { label: '(UTC+12:00) Auckland, Wellington', value: 'Pacific/Auckland' },
]

type TabKey = 'profile' | 'subscription' | 'card' | 'data'

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  )
}

function SettingsContent() {
  const [activeTab, setActiveTab] = useState<TabKey>('profile')
  const [currentPlan, setCurrentPlan] = useState<PlanKey>('free')
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const searchParams = useSearchParams()

  // Profile edit state
  const [editName, setEditName] = useState('')
  const [editTimezone, setEditTimezone] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)

  // Password state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)

  // Card state
  const [cardInfo, setCardInfo] = useState<{
    brand: string
    last4: string
    exp_month: number
    exp_year: number
  } | null>(null)
  const [cardLoading, setCardLoading] = useState(false)

  // Card update state
  const [cardUpdating, setCardUpdating] = useState(false)

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadProfile()

    const billing = searchParams.get('billing')
    if (billing === 'success') {
      setMessage({
        type: 'success',
        text: 'Subscription activated! Your plan has been upgraded.',
      })
      setActiveTab('subscription')
    } else if (billing === 'cancelled') {
      setMessage({
        type: 'error',
        text: 'Checkout was cancelled. Your plan has not changed.',
      })
      setActiveTab('subscription')
    }

    // Handle return from card update
    const tab = searchParams.get('tab')
    const updated = searchParams.get('updated')
    if (tab === 'card') {
      setActiveTab('card')
      if (updated === 'true') {
        setMessage({
          type: 'success',
          text: 'Your payment method has been updated successfully.',
        })
      }
    }
  }, [searchParams])

  async function loadProfile() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      setUserEmail(user.email || '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, plan, timezone')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUserName(profile.full_name || '')
        setEditName(profile.full_name || '')
        setCurrentPlan((profile.plan as PlanKey) || 'free')
        const tz = profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'
        setTimezone(tz)
        setEditTimezone(tz)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveProfile() {
    setProfileSaving(true)
    try {
      const response = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: editName,
          timezone: editTimezone,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setUserName(editName)
        setTimezone(editTimezone)
        setMessage({ type: 'success', text: 'Profile updated successfully.' })
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to update profile.',
        })
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong.' })
    } finally {
      setProfileSaving(false)
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      setMessage({
        type: 'error',
        text: 'Password must be at least 6 characters.',
      })
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }

    setPasswordSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        setMessage({ type: 'error', text: error.message })
      } else {
        setNewPassword('')
        setConfirmPassword('')
        setMessage({ type: 'success', text: 'Password updated successfully.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to update password.' })
    } finally {
      setPasswordSaving(false)
    }
  }

  async function loadCardInfo() {
    setCardLoading(true)
    try {
      const response = await fetch('/api/settings/card')
      const data = await response.json()
      if (data.card) {
        setCardInfo(data.card)
      }
    } catch (error) {
      console.error('Card fetch error:', error)
    } finally {
      setCardLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'card' && currentPlan !== 'free') {
      loadCardInfo()
    }
  }, [activeTab, currentPlan])

  async function handleUpdateCard() {
    setCardUpdating(true)
    try {
      const response = await fetch('/api/settings/update-card', {
        method: 'POST',
      })

      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to open card update',
        })
      }
    } catch {
      setMessage({
        type: 'error',
        text: 'Something went wrong. Please try again.',
      })
    } finally {
      setCardUpdating(false)
    }
  }

  async function handleUpgrade(plan: string) {
    setCheckoutLoading(plan)
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })

      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to start checkout',
        })
      }
    } catch {
      setMessage({
        type: 'error',
        text: 'Something went wrong. Please try again.',
      })
    } finally {
      setCheckoutLoading(null)
    }
  }

  async function handleManageBilling() {
    setPortalLoading(true)
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
      })

      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to open billing portal',
        })
      }
    } catch {
      setMessage({
        type: 'error',
        text: 'Something went wrong. Please try again.',
      })
    } finally {
      setPortalLoading(false)
    }
  }

  async function handleDeleteAllData() {
    if (deleteConfirm !== 'DELETE') return

    setDeleting(true)
    try {
      const response = await fetch('/api/settings/delete-data', {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        setDeleteConfirm('')
        setMessage({
          type: 'success',
          text: 'All group data has been permanently deleted.',
        })
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to delete data.',
        })
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong.' })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  const planOrder: PlanKey[] = ['free', 'pro', 'enterprise']
  const currentPlanIndex = planOrder.indexOf(currentPlan)

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'profile', label: 'My Profile', icon: <User className="w-4 h-4" /> },
    {
      key: 'subscription',
      label: 'My Subscription',
      icon: <Sparkles className="w-4 h-4" />,
    },
    { key: 'card', label: 'My Card', icon: <CreditCard className="w-4 h-4" /> },
    { key: 'data', label: 'Data', icon: <Shield className="w-4 h-4" /> },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your account, subscription, and data
        </p>
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
              : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
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

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-0 -mb-px overflow-x-auto" aria-label="Settings tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        {/* ============= MY PROFILE TAB ============= */}
        {activeTab === 'profile' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Your Profile Details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={userEmail}
                    disabled
                    className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    Contact support to change your email address
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Time Zone
                </label>
                <select
                  value={editTimezone}
                  onChange={(e) => setEditTimezone(e.target.value)}
                  className="w-full md:w-1/2 px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-6">
                <button
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50"
                >
                  {profileSaving && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  Save Profile
                </button>
              </div>
            </div>

            <hr className="border-gray-200 dark:border-gray-700" />

            {/* Password Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Change Password
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 pr-10 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={handleChangePassword}
                  disabled={
                    passwordSaving || !newPassword || !confirmPassword
                  }
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50"
                >
                  {passwordSaving && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  Update Password
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============= MY SUBSCRIPTION TAB ============= */}
        {activeTab === 'subscription' && (
          <div className="space-y-8">
            {/* Current Plan Summary */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Active Plan
              </h2>
              <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                  {currentPlan === 'enterprise' ? (
                    <Crown className="w-6 h-6 text-amber-500" />
                  ) : currentPlan === 'pro' ? (
                    <Sparkles className="w-6 h-6 text-indigo-500" />
                  ) : (
                    <Shield className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 dark:text-white text-lg">
                    {PLANS[currentPlan].name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {currentPlan === 'free'
                      ? 'Free forever'
                      : `$${PLANS[currentPlan].price}/month`}
                  </div>
                </div>
                {currentPlan !== 'free' && (
                  <button
                    onClick={handleManageBilling}
                    disabled={portalLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 rounded-lg transition disabled:opacity-50"
                  >
                    {portalLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ExternalLink className="w-4 h-4" />
                    )}
                    Manage Billing
                  </button>
                )}
              </div>
            </div>

            {/* Plan Cards */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Choose a Plan
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                {planOrder.map((planKey, index) => {
                  const plan = PLANS[planKey]
                  const isCurrent = planKey === currentPlan
                  const isUpgrade = index > currentPlanIndex
                  const isDowngrade = index < currentPlanIndex
                  const isPro = planKey === 'pro'

                  return (
                    <div
                      key={planKey}
                      className={`relative bg-white dark:bg-gray-800 rounded-xl border-2 p-6 ${
                        isCurrent
                          ? 'border-indigo-500 shadow-md'
                          : isPro
                          ? 'border-indigo-200 dark:border-indigo-800'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      {isCurrent && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="bg-indigo-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                            Current Plan
                          </span>
                        </div>
                      )}
                      {isPro && !isCurrent && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                            Most Popular
                          </span>
                        </div>
                      )}

                      <div className="text-center mb-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          {plan.name}
                        </h3>
                        <div className="mt-2">
                          <span className="text-3xl font-bold text-gray-900 dark:text-white">
                            ${plan.price}
                          </span>
                          {plan.price > 0 && (
                            <span className="text-gray-500 dark:text-gray-400">
                              /mo
                            </span>
                          )}
                        </div>
                      </div>

                      <ul className="space-y-3 mb-6">
                        {plan.features.map((feature) => (
                          <li
                            key={feature}
                            className="flex items-start gap-2 text-sm"
                          >
                            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-gray-300">
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-auto">
                        {isCurrent ? (
                          <div className="w-full py-2.5 text-center text-sm font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 rounded-lg">
                            Your current plan
                          </div>
                        ) : isUpgrade ? (
                          <button
                            onClick={() => handleUpgrade(planKey)}
                            disabled={checkoutLoading !== null}
                            className="w-full py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {checkoutLoading === planKey ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : null}
                            Upgrade to {plan.name}
                          </button>
                        ) : isDowngrade ? (
                          <button
                            onClick={handleManageBilling}
                            disabled={portalLoading}
                            className="w-full py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition disabled:opacity-50"
                          >
                            Downgrade
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============= MY CARD TAB ============= */}
        {activeTab === 'card' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Card Details
            </h2>

            {currentPlan === 'free' ? (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-2">
                  No payment method on file
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Subscribe to a paid plan to add a payment method.
                </p>
              </div>
            ) : cardLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : cardInfo ? (
              <div>
                <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700/50">
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Card Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Last 4 Digits
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Expiration
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-gray-200 dark:border-gray-700">
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white capitalize">
                          {cardInfo.brand}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-mono">
                          •••• {cardInfo.last4}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          {cardInfo.exp_month} / {cardInfo.exp_year}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={handleUpdateCard}
                            disabled={cardUpdating}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
                          >
                            {cardUpdating ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CreditCard className="w-3.5 h-3.5" />
                            )}
                            Update Card
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={handleUpdateCard}
                    disabled={cardUpdating}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50"
                  >
                    {cardUpdating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CreditCard className="w-4 h-4" />
                    )}
                    Update Card
                  </button>
                </div>

                <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">
                  Card updates are handled securely through Stripe.
                </p>
              </div>
            ) : (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  No card found on file
                </p>
                <button
                  onClick={handleUpdateCard}
                  disabled={cardUpdating}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50"
                >
                  {cardUpdating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4" />
                  )}
                  Add Payment Method
                </button>
              </div>
            )}
          </div>
        )}

        {/* ============= DATA TAB ============= */}
        {activeTab === 'data' && (
          <div className="space-y-6">
            <div className="border-2 border-red-200 dark:border-red-800 rounded-xl p-6 bg-red-50/50 dark:bg-red-900/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-lg font-semibold text-red-800 dark:text-red-400">
                  Danger Zone
                </h2>
              </div>

              <p className="text-sm text-red-700 dark:text-red-300 mb-6 leading-relaxed">
                Permanently deletes all Facebook groups, group members,
                integrations, and associated configuration from your account.
                This action cannot be undone.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-red-700 dark:text-red-300 mb-1.5">
                    Type <span className="font-mono font-bold">DELETE</span> to
                    confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="Type DELETE to confirm"
                    className="w-full md:w-64 px-4 py-2.5 bg-white dark:bg-gray-700 border border-red-300 dark:border-red-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition"
                  />
                </div>

                <button
                  onClick={handleDeleteAllData}
                  disabled={deleteConfirm !== 'DELETE' || deleting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Permanently DELETE All Group Data
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
