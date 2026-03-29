import Link from 'next/link'

export default function Forbidden() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <h1 className="text-6xl font-bold text-gray-300">403</h1>
      <h2 className="mt-4 text-xl font-semibold text-gray-900">Access Denied</h2>
      <p className="mt-2 text-sm text-gray-500 text-center max-w-md">
        You do not have permission to access this page.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
      >
        Go Home
      </Link>
    </div>
  )
}
