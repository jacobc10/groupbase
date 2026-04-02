import Link from 'next/link'

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-950 dark:to-blue-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex justify-center mb-8">
          <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            GroupBase
          </span>
        </Link>

        {/* Auth Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
          {children}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 dark:text-gray-400 text-sm mt-6">
          By continuing, you agree to our{' '}
          <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">
            Terms
          </a>{' '}
          and{' '}
          <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  )
}
