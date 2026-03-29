'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { collegesApi } from '@/lib/admin-api'
import { formatDate } from '@/lib/utils'
import type { College } from '@/types'

export default function ViewCollegePage() {
  const { id } = useParams<{ id: string }>()
  const [college, setCollege] = useState<College | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await collegesApi.get(Number(id))
        setCollege(data)
      } catch {
        setError('Failed to load college.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function toggleStatus() {
    if (!college) return
    try {
      if (college.isActive) {
        await collegesApi.deactivate(college.id)
      } else {
        await collegesApi.activate(college.id)
      }
      setCollege({ ...college, isActive: !college.isActive })
    } catch {
      setError('Failed to update status.')
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (error) return <Alert variant="error">{error}</Alert>
  if (!college) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/colleges" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{college.name}</h1>
            <p className="mt-1 text-sm text-gray-500">College code: {college.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={toggleStatus} icon={college.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}>
            {college.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Link href={`/admin/colleges/${college.id}/edit`}>
            <Button icon={<Pencil className="h-4 w-4" />}>Edit</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="College Information" />
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-gray-500">Code</dt>
              <dd className="mt-1 text-gray-900 dark:text-gray-300">{college.code}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Status</dt>
              <dd className="mt-1"><Badge variant={college.isActive ? 'success' : 'default'}>{college.isActive ? 'Active' : 'Inactive'}</Badge></dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Dean</dt>
              <dd className="mt-1 text-gray-900 dark:text-gray-300">{college.dean || '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Departments</dt>
              <dd className="mt-1 text-gray-900 dark:text-gray-300">{college.departmentCount ?? 0}</dd>
            </div>
            <div className="col-span-2">
              <dt className="font-medium text-gray-500">Description</dt>
              <dd className="mt-1 text-gray-900 dark:text-gray-300">{college.description || '—'}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Metadata" />
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-gray-900 dark:text-gray-300">{formatDate(college.createdAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Last Updated</dt>
              <dd className="mt-1 text-gray-900 dark:text-gray-300">{college.updatedAt ? formatDate(college.updatedAt) : '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Users</dt>
              <dd className="mt-1 text-gray-900 dark:text-gray-300">{college.userCount ?? 0}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  )
}
