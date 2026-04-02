'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Sparkles } from 'lucide-react'

const plans = [
  {
    key: 'free',
    name: 'Free',
    price: 0,
    description: 'Get started with one group',
    features: [
      '1 Facebook Group',
      'Up to 100 members',
      'Basic member management',
      'Chrome extension capture',
      'Member search & filter',
    ],
    cta: 'Get Started Free',
    href: '/signup',
    highlighted: false,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 47,
    description: 'For serious community builders',
    features: [
      'Up to 3 Facebook Groups',
      'Unlimited members',
      'CSV export & import',
      'Webhook integrations',
      'Tags & bulk actions',
      'Priority support',
    ],
    cta: 'Start Pro Plan',
    href: '/signup?plan=pro',
    highlighted: true,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 97,
    description: 'For agencies & power users',
    features: [
      'Unlimited Facebook Groups',
      'Unlimited members',
      'All integrations (GoHighLevel, Mailchimp, Zapier)',
      'Team management & roles',
      'CSV export & import',
      'White-glove onboarding',
      'Dedicated support',
    ],
    cta: 'Start Enterprise Plan',
    href: '/signup?plan=enterprise',
    highlighted: false,
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            GroupBase
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Pricing Section */}
      <div className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Turn your Facebook Group into a lead machine. Start free, upgrade when you&apos;re ready.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.key}
              className={`relative bg-white rounded-2xl shadow-sm border-2 p-8 flex flex-col ${
                plan.highlighted
                  ? 'border-indigo-500 shadow-lg shadow-indigo-100 scale-105'
                  : 'border-gray-200'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-semibold px-4 py-1.5 rounded-full">
                    <Sparkles className="w-4 h-4" />
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">{plan.name}</h2>
                <p className="text-gray-500 text-sm mt-1">{plan.description}</p>
              </div>

              <div className="mb-8">
                <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                {plan.price > 0 && (
                  <span className="text-gray-500">/month</span>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`block w-full py-3 text-center text-sm font-semibold rounded-lg transition ${
                  plan.highlighted
                    ? 'text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md'
                    : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ teaser */}
        <div className="text-center mt-16">
          <p className="text-gray-500">
            All plans include the GroupBase Chrome extension.{' '}
            <Link href="/login" className="text-indigo-600 hover:underline">
              Questions? Sign in and chat with us.
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
