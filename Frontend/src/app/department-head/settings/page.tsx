'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { dhProfileApi, dhSettingsApi } from '@/lib/department-head-api'

interface DepartmentHeadSettingsView {
  currentAcademicYear: {
    id: number
    year: string
    currentSemester?: string | null
  } | null
  activeSemester?: string | null
  hasActiveSemester?: boolean
}

interface PasswordFormState {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const initialPasswordForm: PasswordFormState = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
}

export default function DHSettingsPage() {
  const [settings, setSettings] = useState<DepartmentHeadSettingsView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(initialPasswordForm)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  useEffect(() => {
    dhSettingsApi.get()
      .then((data) => setSettings(data as unknown as DepartmentHeadSettingsView))
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>

  const academicYear = settings?.currentAcademicYear?.year || 'Not set'
  const activeSemester = settings?.activeSemester || settings?.currentAcademicYear?.currentSemester || 'Not set'
  const semesterStatus = settings?.hasActiveSemester ? 'Active' : 'Inactive'

  function setPasswordField(field: keyof PasswordFormState, value: string) {
    setPasswordForm((prev) => ({ ...prev, [field]: value }))
    setPasswordError('')
    setPasswordSuccess('')
  }

  function togglePasswordForm() {
    setShowPasswordForm((prev) => !prev)
    setPasswordForm(initialPasswordForm)
    setPasswordError('')
    setPasswordSuccess('')
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('All password fields are required.')
      return
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }

    setPasswordSaving(true)
    try {
      const response = await dhProfileApi.changePassword(passwordForm)
      setPasswordSuccess(response.message || 'Password changed successfully.')
      setPasswordForm(initialPasswordForm)
      setShowPasswordForm(false)
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { message?: string; error?: { message?: string } } } })
        ?.response?.data?.message
        || (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      setPasswordError(typeof apiMessage === 'string' ? apiMessage : 'Failed to change password.')
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Department Settings</h1>
        <p className="mt-1 text-sm text-gray-500">View current system settings available to department heads</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      <Alert variant="info">
        System settings are managed by administrators. Department heads can view, but cannot modify, these values.
      </Alert>

      <Card>
        <CardHeader title="Current System Period" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Academic Year</p>
            <p className="mt-2 text-sm font-semibold text-gray-900">{academicYear}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Active Semester</p>
            <p className="mt-2 text-sm font-semibold text-gray-900">{activeSemester}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Semester Status</p>
            <p className="mt-2 text-sm font-semibold text-gray-900">{semesterStatus}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Account Security" />
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Password</p>
              <p className="mt-1 text-xs text-gray-500">Update the password for this Department Head account.</p>
            </div>
            <Button variant={showPasswordForm ? 'secondary' : 'primary'} onClick={togglePasswordForm}>
              {showPasswordForm ? 'Hide Change Password' : 'Change Password'}
            </Button>
          </div>

          {passwordError && <Alert variant="error">{passwordError}</Alert>}
          {passwordSuccess && <Alert variant="success">{passwordSuccess}</Alert>}

          {showPasswordForm && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
              <Input
                label="Current Password"
                type="password"
                autoComplete="current-password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordField('currentPassword', e.target.value)}
              />
              <Input
                label="New Password"
                type="password"
                autoComplete="new-password"
                helperText="Password must be at least 6 characters long."
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordField('newPassword', e.target.value)}
              />
              <Input
                label="Confirm New Password"
                type="password"
                autoComplete="new-password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordField('confirmPassword', e.target.value)}
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={togglePasswordForm}>
                  Cancel
                </Button>
                <Button type="submit" loading={passwordSaving}>
                  Update Password
                </Button>
              </div>
            </form>
          )}
        </div>
      </Card>
    </div>
  )
}
