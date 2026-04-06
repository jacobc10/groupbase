import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy - GroupBase',
  description: 'GroupBase privacy policy',
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-indigo-600">GroupBase</Link>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">â Back to Home</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-8">Last updated: April 6, 2026</p>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">1. Introduction</h2>
            <p className="text-gray-700 dark:text-gray-300">
              GroupBase (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) operates the GroupBase web application at usegroupbase.com and the GroupBase Chrome Extension. This Privacy Policy explains how we collect, use, and protect your information when you use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">2. Information We Collect</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              <strong>Account Information:</strong> When you create an account, we collect your name, email address, and password. If you subscribe to a paid plan, payment processing is handled by Stripe â we do not store your credit card details.
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              <strong>Facebook Group Data:</strong> When you use the GroupBase Chrome Extension on Facebook, it captures publicly visible information about members who request to join your Facebook group, including their name, profile URL, and their answers to your group&apos;s membership questions. This data is only captured when you actively interact with your group&apos;s member request page.
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              <strong>Usage Data:</strong> We collect basic usage analytics such as pages visited and features used to improve our service. We do not use third-party tracking or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">3. How We Use Your Information</h2>
            <p className="text-gray-700 dark:text-gray-300">
              We use the information we collect to: provide and maintain our CRM service, display captured member data in your dashboard, send you account-related emails (e.g. billing, security), and improve our product. We do not sell or share your personal information with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">4. Chrome Extension Permissions</h2>
            <p className="text-gray-700 dark:text-gray-300">
              The GroupBase Chrome Extension requests only the minimum permissions necessary to function. It accesses facebook.com to read member request information when you visit your group&apos;s member request page. It uses browser storage to save your login session. The extension does not access any other websites, read your browsing history, or collect data outside of Facebook group pages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">5. Data Storage and Security</h2>
            <p className="text-gray-700 dark:text-gray-300">
              Your data is stored securely using Supabase (hosted on AWS) with row-level security policies ensuring you can only access your own data. All data transmission uses HTTPS encryption. We retain your data for as long as your account is active. You may request deletion of your account and all associated data at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">6. Third-Party Services</h2>
            <p className="text-gray-700 dark:text-gray-300">
              We use the following third-party services: Supabase for database and authentication, Stripe for payment processing, Vercel for hosting, and Resend for transactional email. Each of these services has their own privacy policies governing how they handle data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">7. Integrations</h2>
            <p className="text-gray-700 dark:text-gray-300">
              If you connect GroupBase to third-party services like GoHighLevel, data you choose to sync (such as member names and email addresses) will be shared with those services according to their own privacy policies. You control which integrations are enabled and what data is shared.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">8. Your Rights</h2>
            <p className="text-gray-700 dark:text-gray-300">
              You have the right to: access the personal data we hold about you, request correction of inaccurate data, request deletion of your data, export your data, and withdraw consent for data processing. To exercise any of these rights, contact us at the email below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">9. Changes to This Policy</h2>
            <p className="text-gray-700 dark:text-gray-300">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the &ldquo;Last updated&rdquo; date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">10. Contact Us</h2>
            <p className="text-gray-700 dark:text-gray-300">
              If you have any questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:support@usegroupbase.com" className="text-indigo-600 hover:text-indigo-500">
                support@usegroupbase.com
              </a>.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-800 mt-16">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
          Â© 2026 GroupBase. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
