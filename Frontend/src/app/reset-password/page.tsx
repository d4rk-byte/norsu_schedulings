import Link from 'next/link'

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Password Reset</h1>
        <p className="mt-2 text-sm text-gray-600">
          Self-service password reset is not configured in this environment yet.
          Please contact your system administrator to reset your password.
        </p>
        <div className="mt-6 flex justify-end">
          <Link
            href="/login"
            className="inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
