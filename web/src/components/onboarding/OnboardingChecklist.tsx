'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Check, Circle, ExternalLink, Download, Users, Globe, X } from 'lucide-react'

interface OnboardingChecklistProps {
  groupsCount: number
  membersCount: number
}

export default function OnboardingChecklist({ groupsCount, membersCount }: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(false)
  const [extensionInstalled, setExtensionInstalled] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const isDismissed = localStorage.getItem('groupbase-onboarding-dismissed') === 'true'
    setDismissed(isDismissed)
    const extInstalled = localStorage.getItem('groupbase-extension-installed') === 'true'
    setExtensionInstalled(extInstalled)
  }, [])

  const handleDismiss = () => {
    localStorage.setItem('groupbase-onboarding-dismissed', 'true')
    setDismissed(true)
  }

  if (!mounted || dismissed) {
    return null
  }

  // Step 1: Account created (auto-completed)
  const step1Complete = true

  // Step 2: Connect a Facebook Group
  const step2Complete = groupsCount > 0

  // Step 3: Install Download Extension (manual check via localStorage)
  const step3Complete = extensionInstalled

  // Step 4: Approve a member (auto-complete when members exist)
  const step4Complete = membersCount > 0

  const allComplete = step1Complete && step2Complete && step3Complete && step4Complete

  const steps = [
    {
      id: 1,
      title: 'Create your account',
      description: 'You\'re all set!',
      complete: step1Complete,
      icon: Users,
      action: null,
    },
    {
      id: 2,
      title: 'Connect a Facebook Group',
      description: 'Add your first Facebook group to start tracking members',
      complete: step2Complete,
      icon: Globe,
      action: {
        label: 'Go to Groups',
        href: '/dashboard/groups',
      },
    },
    {
      id: 3,
      title: 'Install the Download Extension',
      description: 'Install our extension to auto-capture member data from Facebook',
      complete: step3Complete,
      icon: Download,
      action: {
        label: 'Install Extension',
        href: 'https://chrome.google.com/webstore/detail/groupbase/bjgajmmmfemeieaoikfjkmnglkhgnohj',
        external: true,
      },
      markDone: () => {
        localStorage.setItem('groupbase-extension-installed', 'true')
        setExtensionInstalled(true)
      },
    },
    {
      id: 4,
      title: 'Approve your first member',
      description: 'Go to your Facebook group, approve a member request, and we\'ll auto-capture them',
      complete: step4Complete,
      icon: Check,
      action: {
        label: 'Learn more',
        href: '/dashboard/groups',
      },
    },
  ]

  const completedCount = steps.filter(s => s.complete).length

  return (
    <div className="mb-8 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800 overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              Welcome to GroupBase!
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Complete these steps to get the most out of your account
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white dark:hover:bg-gray-800 rounded transition text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Dismiss onboarding"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Progress
            </span>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
              {completedCount} of {steps.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-indigo-600 to-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedCount / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <div
                key={step.id}
                className={`flex items-start gap-4 p-4 rounded-lg transition ${
                  step.complete
                    ? 'bg-white/50 dark:bg-gray-800/50'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                }`}
              >
                {/* Step Number / Checkmark */}
                <div className="flex-shrink-0 pt-0.5">
                  {step.complete ? (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                        {index + 1}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className={`font-medium text-sm mb-1 ${
                    step.complete
                      ? 'text-gray-600 dark:text-gray-400'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {step.title}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                    {step.description}
                  </p>

                  {/* Action Button */}
                  {step.action && !step.complete && (
                    <div className="flex items-center gap-2">
                      {step.action.external ? (
                        <a
                          href={step.action.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition"
                        >
                          {step.action.label}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <Link
                          href={step.action.href}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition"
                        >
                          {step.action.label}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                      {step.markDone && (
                        <button
                          onClick={step.markDone}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition"
                        >
                          <Check className="w-3 h-3" />
                          I&apos;ve installed it
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Completion Message */}
        {allComplete && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              You're all set! Your GroupBase onboarding is complete.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
