'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Pencil, UserCheck, UserX, Trash2 } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmModal } from '@/components/ui/Modal'
import { usersApi } from '@/lib/admin-api'
import { ROLE_LABELS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { User } from '@/types'

export default function UserViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    usersApi.get(Number(id))
      .then(setUser)
      .catch(() => setError('Failed to load user.'))
      .finally(() => setLoading(false))
  }, [id])

  async function toggleStatus() {
    if (!user) return
    try {
      user.isActive ? await usersApi.deactivate(user.id) : await usersApi.activate(user.id)
      setUser({ ...user, isActive: !user.isActive })
    } catch { setError('Failed to update status.') }
  }

  async function handleDelete() {
    if (!user) return
    try {
      await usersApi.delete(user.id)
      router.push('/admin/users')
    } catch { setError('Failed to delete user.') }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (error || !user) return <Alert variant="error">{error || 'User not found.'}</Alert>

  const roleBadge: Record<number, 'danger' | 'warning' | 'primary'> = { 1: 'danger', 2: 'warning', 3: 'primary' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/users" className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><ArrowLeft className="h-5 w-5 text-gray-500" /></Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{user.fullName || user.username}</h1>
            <p className="mt-1 text-sm text-gray-500"><Badge variant={roleBadge[user.role] || 'default'}>{user.roleDisplayName || ROLE_LABELS[user.role]}</Badge></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={toggleStatus}>{user.isActive ? <><UserX className="h-4 w-4 mr-1" />Deactivate</> : <><UserCheck className="h-4 w-4 mr-1" />Activate</>}</Button>
          <Link href={`/admin/users/${id}/edit`}><Button size="sm"><Pencil className="h-4 w-4 mr-1" />Edit</Button></Link>
          <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Account Information" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-gray-500">Username</dt><dd className="font-medium">{user.username}</dd>
            <dt className="text-gray-500">Email</dt><dd className="font-medium">{user.email}</dd>
            <dt className="text-gray-500">Employee ID</dt><dd className="font-medium">{user.employeeId || '—'}</dd>
            <dt className="text-gray-500">Status</dt><dd><Badge variant={user.isActive ? 'success' : 'default'}>{user.isActive ? 'Active' : 'Inactive'}</Badge></dd>
            <dt className="text-gray-500">Last Login</dt><dd className="font-medium">{user.lastLogin ? formatDate(user.lastLogin) : 'Never'}</dd>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Personal Information" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-gray-500">First Name</dt><dd className="font-medium">{user.firstName || '—'}</dd>
            <dt className="text-gray-500">Middle Name</dt><dd className="font-medium">{user.middleName || '—'}</dd>
            <dt className="text-gray-500">Last Name</dt><dd className="font-medium">{user.lastName || '—'}</dd>
            <dt className="text-gray-500">Position</dt><dd className="font-medium">{user.position || '—'}</dd>
            <dt className="text-gray-500">Other Designation</dt><dd className="font-medium">{user.otherDesignation || '—'}</dd>
            <dt className="text-gray-500">Address</dt><dd className="font-medium">{user.address || '—'}</dd>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Organization" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-gray-500">College</dt><dd className="font-medium">{user.college?.name || '—'}</dd>
            <dt className="text-gray-500">Department</dt><dd className="font-medium">{user.department?.name || '—'}</dd>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Metadata" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-gray-500">Created</dt><dd className="font-medium">{user.createdAt ? formatDate(user.createdAt) : '—'}</dd>
            <dt className="text-gray-500">Updated</dt><dd className="font-medium">{user.updatedAt ? formatDate(user.updatedAt) : '—'}</dd>
          </dl>
        </Card>
      </div>

      <ConfirmModal open={showDelete} onClose={() => setShowDelete(false)} onConfirm={handleDelete} title="Delete User" confirmLabel="Delete" variant="danger" message={`Are you sure you want to delete "${user.fullName || user.username}"? This action cannot be undone.`} />
    </div>
  )
}
