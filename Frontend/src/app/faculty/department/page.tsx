'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Building,
  GraduationCap,
  Briefcase,
  IdCard,
  User,
  Mail,
  MapPin,
} from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { facultyApi, type FacultyProfileData } from '@/lib/faculty-api'

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900 dark:text-white/90">{value}</p>
      </div>
    </div>
  )
}

export default function FacultyDepartmentPage() {
  const [profile, setProfile] = useState<FacultyProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDepartmentInfo = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await facultyApi.getProfile()
      setProfile(response)
    } catch {
      setError('Failed to load department information.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDepartmentInfo()
  }, [loadDepartmentInfo])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (error && !profile) {
    return (
      <div className="space-y-4">
        <Alert variant="error">{error}</Alert>
        <Button type="button" variant="secondary" onClick={() => void loadDepartmentInfo()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white/90">Department</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Your department and institutional assignment details.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={profile?.department ? 'success' : 'warning'}>
            {profile?.department ? 'Department Assigned' : 'Needs Assignment'}
          </Badge>
        </div>
      </div>

      {error && profile && <Alert variant="error">{error}</Alert>}

      {!profile?.department && (
        <Alert variant="warning" title="No department assigned yet">
          Your account does not have a department assignment yet. Please update your profile details or contact your administrator.
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Department Overview" description="Current institutional assignment" />
          <div className="space-y-3">
            <DetailRow icon={Building} label="Department" value={profile?.department?.name ?? 'Not assigned'} />
            <DetailRow icon={GraduationCap} label="College" value={profile?.college?.name ?? 'Not assigned'} />
            <DetailRow icon={Briefcase} label="Position" value={profile?.position ?? 'Not set'} />
            <DetailRow icon={IdCard} label="Employee ID" value={profile?.employee_id ?? 'Not set'} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Faculty Contact" description="Reference details from your faculty profile" />
          <div className="space-y-3">
            <DetailRow icon={User} label="Full Name" value={profile?.full_name ?? 'Not set'} />
            <DetailRow icon={Mail} label="Email" value={profile?.email ?? 'Not set'} />
            <DetailRow icon={MapPin} label="Address" value={profile?.address ?? 'Not set'} />
          </div>
        </Card>
      </div>

      <Card className="border-primary-100 bg-primary-50/40 dark:border-primary-900/40 dark:bg-primary-900/10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-stone-900 dark:text-white/90">Need to update your department details?</p>
            <p className="text-sm text-stone-600 dark:text-gray-300">You can edit profile information used by this page from your profile screen.</p>
          </div>
          <Link
            href="/faculty/profile"
            className="inline-flex items-center justify-center rounded-lg border border-primary-200 bg-white px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50 transition-colors dark:border-primary-800 dark:bg-gray-800 dark:text-primary-300 dark:hover:bg-gray-700"
          >
            Open Profile
          </Link>
        </div>
      </Card>
    </div>
  )
}