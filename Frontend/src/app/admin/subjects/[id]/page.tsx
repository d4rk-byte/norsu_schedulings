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
import { subjectsApi } from '@/lib/admin-api'
import { formatDate } from '@/lib/utils'
import type { Subject } from '@/types'

export default function ViewSubjectPage() {
  const { id } = useParams<{ id: string }>()
  const [subject, setSubject] = useState<Subject | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    subjectsApi.get(Number(id)).then(setSubject).catch(() => setError('Failed to load subject.')).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (error) return <Alert variant="error">{error}</Alert>
  if (!subject) return <Alert variant="error">Subject not found.</Alert>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/subjects" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><ArrowLeft className="h-5 w-5 text-gray-500" /></Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{subject.title}</h1>
            <p className="mt-1 text-sm text-gray-500">{subject.code}</p>
          </div>
        </div>
        <Link href={`/admin/subjects/${subject.id}/edit`}><Button icon={<Pencil className="h-4 w-4" />}>Edit</Button></Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Subject Information" />
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="font-medium text-gray-500">Code</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{subject.code}</dd></div>
            <div><dt className="font-medium text-gray-500">Units</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{subject.units}</dd></div>
            <div><dt className="font-medium text-gray-500">Lecture Hours</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{subject.lectureHours}</dd></div>
            <div><dt className="font-medium text-gray-500">Lab Hours</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{subject.labHours}</dd></div>
            <div><dt className="font-medium text-gray-500">Type</dt><dd className="mt-1"><Badge variant={subject.type === 'laboratory' ? 'warning' : subject.type === 'lecture-lab' ? 'purple' : 'primary'}>{subject.type}</Badge></dd></div>
            <div><dt className="font-medium text-gray-500">Status</dt><dd className="mt-1"><Badge variant={subject.isActive ? 'success' : 'default'}>{subject.isActive ? 'Active' : 'Inactive'}</Badge></dd></div>
            <div><dt className="font-medium text-gray-500">Year Level</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{subject.yearLevel ? `Year ${subject.yearLevel}` : '—'}</dd></div>
            <div><dt className="font-medium text-gray-500">Semester</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{subject.semester || '—'}</dd></div>
            <div><dt className="font-medium text-gray-500">Department</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{subject.department?.name || '—'}</dd></div>
            <div className="col-span-2"><dt className="font-medium text-gray-500">Description</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{subject.description || '—'}</dd></div>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Metadata" />
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="font-medium text-gray-500">Created</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{formatDate(subject.createdAt)}</dd></div>
            <div><dt className="font-medium text-gray-500">Updated</dt><dd className="mt-1 text-gray-900 dark:text-gray-300">{formatDate(subject.updatedAt)}</dd></div>
          </dl>
        </Card>
      </div>
    </div>
  )
}
