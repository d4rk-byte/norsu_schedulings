'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function Home() {
  const router = useRouter()
  const { isAuthenticated, isLoading, getDashboardPath } = useAuth()

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace(getDashboardPath())
      } else {
        router.replace('/login')
      }
    }
  }, [isAuthenticated, isLoading, getDashboardPath, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
    </div>
  )
}
