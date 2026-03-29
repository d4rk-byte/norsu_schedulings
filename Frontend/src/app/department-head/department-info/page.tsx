'use client'

import { useEffect, useState } from 'react'
import { Loader2, Building, Mail, Users, MapPin } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { dhDepartmentInfo } from '@/lib/department-head-api'
import type { Department } from '@/types'

export default function DepartmentInfoPage() {
  const [dept, setDept] = useState<Department | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    dhDepartmentInfo.get()
      .then(setDept)
      .catch(() => setError('Failed to load department information'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
  if (error) return <Alert variant="error">{error}</Alert>
  if (!dept) return <Alert variant="error">Department not found</Alert>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Department Information</h1>
        <p className="mt-1 text-sm text-gray-500">Details about your department</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader title="General Details" />
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-gray-500">Department Name</dt>
                <dd className="mt-1 font-medium text-gray-900 flex items-center gap-1">
                  <Building className="h-3.5 w-3.5 text-gray-400" />{dept.name}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Code</dt>
                <dd className="mt-1 font-medium text-gray-900">{dept.code}</dd>
              </div>
              <div>
                <dt className="text-gray-500">College</dt>
                <dd className="mt-1 font-medium text-gray-900">{dept.college?.name || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Department Group</dt>
                <dd className="mt-1 font-medium text-gray-900">{dept.departmentGroup?.name || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Contact Email</dt>
                <dd className="mt-1 font-medium text-gray-900 flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-gray-400" />{dept.contactEmail || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Department Head</dt>
                <dd className="mt-1 font-medium text-gray-900">{dept.head?.fullName || '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-gray-500">Description</dt>
                <dd className="mt-1 text-gray-700">{dept.description || 'No description provided.'}</dd>
              </div>
            </dl>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Status" />
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Active</span>
                <Badge variant={dept.isActive ? 'success' : 'danger'}>{dept.isActive ? 'Active' : 'Inactive'}</Badge>
              </div>
              {dept.userCount !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Faculty Members</span>
                  <span className="font-medium">{dept.userCount}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Created</span>
                <span className="font-medium">{dept.createdAt ? new Date(dept.createdAt).toLocaleDateString() : '—'}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
