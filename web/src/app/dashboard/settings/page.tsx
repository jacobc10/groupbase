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

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>}>
      <SettingsContent />
    </Suspense>
  )
}

function SettingsContent() {
  const [currentPlan, setCurrentPlan] = useState<PlanKey>('free')
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    loadProfile()

    const billing = searchParams.get('billing')
    if (billing === 'success') {
      setMessage({ type: 'success', text: 'Subscription activated! Your plan has been upgraded.' })
    } else if (billing === 'cancelled') {
      setMessage({ type: 'error', text: 'Checkout was cancelled. Your plan has not changed.' })
    }
  }, [searchParams])

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserEmail(user.email || '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, plan')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUserName(profile.full_name || '')
        setCurrentPlan((profile.plan as PlanKey) || 'free')
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
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
        setMessage({ type: 'error', text: data.error || 'Failed to start checkout' })
      }
    } catch (error) {
      console.error('Checkout error:', error)
      setMessage({ type: 'error', text: 'Something went wrong. Please try again.' })
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
        setMessage({ type: 'error', text: data.error || 'Failed to open billing portal' })
      }
    } catch (error) {
      console.error('Portal error:', error)
      setMessage({ type: 'error', text: 'Something went wrong. Please try again.' })
    } finally {
      setPortalLoading(false)
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

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your account and subscription
        </p>
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

      {/* Account Info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-500 dark:text-gray-400">Name</label>
            <p className="text-gray-900 dark:text-white">{userName || '—'}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500 dark:text-gray-400">Email</label>
            <p className="text-gray-900 dark:text-white">{userEmail || '—'}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500 dark:text-gray-400">Current Plan</label>
            <div className="flex items-center gap-2 mt-1">
              {currentPlan === 'enterprise' ? (
                <Crown className="w-5 h-5 text-amber-500" />
              ) : currentPlan === 'pro' ? (
                <Sparkles className="w-5 h-5 text-indigo-500" />
              ) : (
                <Shield className="w-5 h-5 text-gray-400" />
              )}
              <span className="font-semibold text-gray-900 dark:text-white capitalize">
                {PLANS[currentPlan].name}
              </span>
              {currentPlan !== 'free' && (
                <span className="text-sm text-gray-500">
                  (${PLANS[currentPlan].price}/month)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Manage Billing Button */}
        {currentPlan !== 'free' && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition disabled:opacity-50"
            >
              {portalLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4" />
              )}
              Manage Billing
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Plan Cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Plans</h2>
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
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">
                      ${plan.price}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-gray-500 dark:text-gray-400">/mo</span>
                    )}
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
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
  )
}
