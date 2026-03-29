'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { departmentsApi } from '@/lib/admin-api'
import { formatDate } from '@/lib/utils'
import type { Department } from '@/types'

export default function ViewDepartmentPage() {
  const { id } = useParams<{ id: string }>()
  const [dept, setDept] = useState<Department | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try { setDept(await departmentsApi.get(Number(id))) } catch { setError('Failed to load department.') } finally { setLoading(false) }
    }
    load()
  }, [id])

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (error) return <Alert variant="error">{error}</Alert>
  if (!dept) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/departments" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><ArrowLeft className="h-5 w-5 text-gray-500" /></Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{dept.name}</h1>
            <p className="mt-1 text-sm text-gray-500">Department code: {dept.code}</p>
          </div>
        </div>
        <Link href={`/admin/departments/${dept.id}/edit`}><Button icon={<Pencil className="h-4 w-4" />}>Edit</Button></Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Department Information" />
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="font-medium text-gray-500">Code</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{dept.code}</dd></div>
            <div><dt className="font-medium text-gray-500">Status</dt><dd className="mt-1"><Badge variant={dept.isActive ? 'success' : 'default'}>{dept.isActive ? 'Active' : 'Inactive'}</Badge></dd></div>
            <div><dt className="font-medium text-gray-500">College</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{dept.college?.name || '—'}</dd></div>
            <div><dt className="font-medium text-gray-500">Head</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{dept.head?.fullName || '—'}</dd></div>
            <div><dt className="font-medium text-gray-500">Group</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{dept.departmentGroup?.name || '—'}</dd></div>
            <div><dt className="font-medium text-gray-500">Contact Email</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{dept.contactEmail || '—'}</dd></div>
            <div className="col-span-2"><dt className="font-medium text-gray-500">Description</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{dept.description || '—'}</dd></div>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Metadata" />
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="font-medium text-gray-500">Created</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{formatDate(dept.createdAt)}</dd></div>
            <div><dt className="font-medium text-gray-500">Last Updated</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{formatDate(dept.updatedAt)}</dd></div>
            <div><dt className="font-medium text-gray-500">Users</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{dept.userCount ?? 0}</dd></div>
          </dl>
        </Card>
      </div>
    </div>
  )
}
