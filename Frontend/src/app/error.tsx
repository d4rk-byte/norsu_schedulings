'use client'

import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <h1 className="text-6xl font-bold text-gray-300">500</h1>
      <h2 className="mt-4 text-xl font-semibold text-gray-900">Something Went Wrong</h2>
      <p className="mt-2 text-sm text-gray-500 text-center max-w-md">
        An unexpected error occurred. Please try again.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}
