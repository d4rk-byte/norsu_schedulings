'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, UserX, UserCheck, Loader2, Mail, Phone, MapPin, Briefcase } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { ConfirmModal } from '@/components/ui/Modal'
import { dhFacultyApi } from '@/lib/department-head-api'
import type { User } from '@/types'

export default function DHFacultyViewPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showToggle, setShowToggle] = useState(false)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    dhFacultyApi.get(Number(id))
      .then(setUser)
      .catch(() => setError('Failed to load faculty member'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleToggleStatus() {
    if (!user) return
    setToggling(true)
    try {
      if (user.isActive) {
        await dhFacultyApi.deactivate(user.id)
      } else {
        await dhFacultyApi.activate(user.id)
      }
      setUser(prev => prev ? { ...prev, isActive: !prev.isActive } : prev)
    } catch {
      setError('Failed to update status.')
    } finally {
      setToggling(false)
      setShowToggle(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
  if (error || !user) return <Alert variant="error">{error || 'Faculty not found'}</Alert>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/department-head/faculty" className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft className="h-5 w-5 text-gray-500" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{user.fullName}</h1>
          <p className="mt-1 text-sm text-gray-500">Faculty Member</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/department-head/faculty/${user.id}/edit`}><Button variant="secondary" icon={<Edit className="h-4 w-4" />}>Edit</Button></Link>
          <Button variant={user.isActive ? 'danger' : 'primary'} icon={user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />} onClick={() => setShowToggle(true)}>
            {user.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader title="Personal Information" />
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div><dt className="text-gray-500">Full Name</dt><dd className="mt-1 font-medium text-gray-900">{user.fullName}</dd></div>
              <div><dt className="text-gray-500">Username</dt><dd className="mt-1 font-medium text-gray-900">{user.username}</dd></div>
              <div><dt className="text-gray-500">Email</dt><dd className="mt-1 font-medium text-gray-900 flex items-center gap-1"><Mail className="h-3.5 w-3.5 text-gray-400" />{user.email}</dd></div>
              <div><dt className="text-gray-500">Employee ID</dt><dd className="mt-1 font-medium text-gray-900">{user.employeeId || '—'}</dd></div>
              <div><dt className="text-gray-500">Position</dt><dd className="mt-1 font-medium text-gray-900 flex items-center gap-1"><Briefcase className="h-3.5 w-3.5 text-gray-400" />{user.position || '—'}</dd></div>
              <div><dt className="text-gray-500">Address</dt><dd className="mt-1 font-medium text-gray-900 flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-gray-400" />{user.address || '—'}</dd></div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Department & College" />
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div><dt className="text-gray-500">Department</dt><dd className="mt-1 font-medium text-gray-900">{user.department?.name || '—'}</dd></div>
              <div><dt className="text-gray-500">College</dt><dd className="mt-1 font-medium text-gray-900">{user.college?.name || '—'}</dd></div>
            </dl>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Account Status" />
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Status</span>
                <Badge variant={user.isActive ? 'success' : 'danger'}>{user.isActive ? 'Active' : 'Inactive'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Last Login</span>
                <span className="font-medium">{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Created</span>
                <span className="font-medium">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Updated</span>
                <span className="font-medium">{user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : '—'}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={showToggle}
        onClose={() => setShowToggle(false)}
        onConfirm={handleToggleStatus}
        loading={toggling}
        title={user.isActive ? 'Deactivate Faculty' : 'Activate Faculty'}
        variant={user.isActive ? 'danger' : 'primary'}
        confirmLabel={user.isActive ? 'Deactivate' : 'Activate'}
        message={`Are you sure you want to ${user.isActive ? 'deactivate' : 'activate'} "${user.fullName}"?`}
      />
    </div>
  )
}
