'use client'

import Link from 'next/link'
import { ArrowRight, Users, BarChart3, Zap, Shield, MessageSquare, Puzzle } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-950 dark:to-blue-900">
      {/* Navigation */}
      <nav className="fixed w-full top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            GroupBase
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition">
              Login
            </Link>
            <Link href="/signup" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition">
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6">
            Turn Your Facebook Group Into a{' '}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Revenue Machine
            </span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
            GroupBase is a powerful CRM designed specifically for Facebook group owners. Automatically capture members, track their journey, and convert them into customers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-medium text-lg transition transform hover:scale-105">
              Start Free Trial <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link href="#features" className="inline-flex items-center justify-center border-2 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white px-8 py-4 rounded-lg font-medium text-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">Powerful Features</h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-16 max-w-2xl mx-auto">
            Everything you need to manage and grow your Facebook group community
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Auto-Capture Members</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Automatically capture new Facebook group members and their details with our browser extension.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">CRM Dashboard</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Manage members, track conversations, and monitor their status throughout the sales funnel.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Team Collaboration</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Invite team members, assign leads, and collaborate seamlessly on member management.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-8 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition">
              <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900 rounded-lg flex items-center justify-center mb-4">
                <Puzzle className="w-6 h-6 text-pink-600 dark:text-pink-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Rich Integrations</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Connect with GoHighLevel, Mailchimp, Zapier, and other tools you already use.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-8 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition">
              <div className="w-12 h-12 bg-cyan-100 dark:bg-cyan-900 rounded-lg flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Track Interactions</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Log conversations, notes, and interactions with each member automatically.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-8 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Automation</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Automate follow-ups, tagging, and lead qualification based on member behavior.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">Simple, Transparent Pricing</h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-16 max-w-2xl mx-auto">
            Start free and scale as you grow
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Tier */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-8 hover:shadow-lg dark:hover:shadow-blue-900/20 transition">
              <h3 className="text-2xl font-bold mb-2">Free</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Perfect for getting started</p>
              <div className="text-4xl font-bold mb-6">$0<span className="text-lg text-gray-600 dark:text-gray-400">/mo</span></div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center text-sm">
                  <span className="w-4 h-4 bg-green-500 rounded-full mr-3 flex-shrink-0"></span>
                  Up to 100 members
                </li>
                <li className="flex items-center text-sm">
                  <span className="w-4 h-4 bg-green-500 rounded-full mr-3 flex-shrink-0"></span>
                  Basic member tracking
                </li>
                <li className="flex items-center text-sm">
                  <span className="w-4 h-4 bg-green-500 rounded-full mr-3 flex-shrink-0"></span>
                  One group
                </li>
                <li className="flex items-center text-sm text-gray-400">
                  <span className="w-4 h-4 bg-gray-300 rounded-full mr-3 flex-shrink-0"></span>
                  Integrations
                </li>
              </ul>
              <button className="w-full py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                Get Started
              </button>
            </div>

            {/* Pro Tier */}
            <div className="rounded-xl border-2 border-blue-500 p-8 bg-gradient-to-br from-blue-50 dark:from-blue-950 to-transparent relative">
              <div className="absolute -top-4 left-6 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                Most Popular
              </div>
              <h3 className="text-2xl font-bold mb-2">Pro</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">For growing businesses</p>
              <div className="text-4xl font-bold mb-6">$47<span className="text-lg text-gray-600 dark:text-gray-400">/mo</span></div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center text-sm">
                  <span className="w-4 h-4 bg-green-500 rounded-full mr-3 flex-shrink-0"></span>
                  Unlimited members
                </li>
                <li className="flex items-center text-sm">
                  <span className="w-4 h-4 bg-green-500 rounded-full mr-3 flex-shrink-0"></span>
                  Up to 3 Facebook Groups
                </li>
                <li className="flex items-center text-sm">
                  <span className="w-4 h-4 bg-green-500 rounded-full mr-3 flex-shrink-0"></span>
                  CSV export & import
                </li>
                <li className="flex items-center text-sm">
                  <span className="w-4 h-4 bg-green-500 rounded-full mr-3 flex-shrink-0"></span>
                  Webhook integrations
                </li>
              </ul>
              <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
                Start Free Trial
              </button>
            </div>

            {/* Enterprise Tier */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-8 hover:shadow-lg dark:hover:shadow-blue-900/20 transition">
              <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">For large organizations</p>
              <div className="text-4xl font-bold mb-6">$97<span className="text-lg text-gray-600 dark:text-gray-400">/mo</span></div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center text-sm">
                  <span className="w-4 h-4 bg-green-500 rounded-full mr-3 flex-shrink-0"></span>
                  Unlimited Facebook Groups
                </li>
                <li className="flex items-center text-sm">
                  <span className="w-4 h-4 bg-green-500 rounded-full mr-3 flex-shrink-0"></span>
                  Unlimited members
                </li>
                <li className="flex items-center text-sm">
                  <span className="w-4 h-4 bg-green-500 rounded-full mr-3 flex-shrink-0"></span>
                  All integrations (GoHighLevel, Mailchimp, Zapier)
                </li>
                <li className="flex items-center text-sm">
                  <span className="w-4 h-4 bg-green-500 rounded-full mr-3 flex-shrink-0"></span>
                  Team management & dedicated support
                </li>
              </ul>
              <button className="w-full py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-blue-600 dark:bg-blue-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to grow your community?</h2>
          <p className="text-xl text-blue-100 mb-8">
            Start converting your Facebook group members into customers today.
          </p>
          <Link href="/signup" className="inline-flex items-center justify-center bg-white hover:bg-gray-100 text-blue-600 px-8 py-4 rounded-lg font-medium text-lg transition">
            Get Started Free <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center text-gray-600 dark:text-gray-400">
          <p>&copy; 2026 GroupBase. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
