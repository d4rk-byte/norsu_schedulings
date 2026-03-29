'use client'

import { useEffect, useState } from 'react'
import {
  User,
  Mail,
  MapPin,
  Building,
  Briefcase,
  IdCard,
  Save,
  BookOpen,
  KeyRound,
} from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { facultyApi, type FacultyProfileData, type FacultyProfileUpdateInput } from '@/lib/faculty-api'

function getErrorMessage(error: unknown, fallback: string): string {
  const withResponse = error as {
    response?: {
      data?: {
        error?: { message?: string }
        message?: string
      }
    }
    message?: string
  }

  return (
    withResponse.response?.data?.error?.message
    || withResponse.response?.data?.message
    || withResponse.message
    || fallback
  )
}

const initialPasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
}

export default function FacultyProfilePage() {
  const [profile, setProfile] = useState<FacultyProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<FacultyProfileUpdateInput>({})
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordForm, setPasswordForm] = useState(initialPasswordForm)

  useEffect(() => {
    facultyApi.getProfile()
      .then((p) => {
        setProfile(p)
        setForm({
          first_name: p.first_name ?? '',
          middle_name: p.middle_name ?? '',
          last_name: p.last_name ?? '',
          address: p.address ?? '',
          other_designation: p.other_designation ?? '',
        })
      })
      .catch((err: unknown) => setError(getErrorMessage(err, 'Failed to load profile.')))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await facultyApi.updateProfile(form)
      setSuccess('Profile updated successfully.')
      setEditing(false)
      // Refresh profile
      const updated = await facultyApi.getProfile()
      setProfile(updated)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update profile.'))
    } finally {
      setSaving(false)
    }
  }

  const hidePasswordForm = () => {
    setShowPasswordForm(false)
    setPasswordError('')
    setPasswordSuccess('')
    setPasswordForm(initialPasswordForm)
  }

  const handleTogglePasswordForm = () => {
    if (showPasswordForm) {
      hidePasswordForm()
      return
    }

    setPasswordError('')
    setPasswordSuccess('')
    setShowPasswordForm(true)
  }

  const handleChangePassword = async () => {
    setPasswordError('')
    setPasswordSuccess('')

    const currentPassword = passwordForm.currentPassword.trim()
    const newPassword = passwordForm.newPassword.trim()
    const confirmPassword = passwordForm.confirmPassword.trim()

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required.')
      return
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }

    setPasswordSaving(true)
    try {
      const response = await facultyApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      })

      setPasswordSuccess(response.message || 'Password changed successfully.')
      setPasswordForm(initialPasswordForm)
    } catch (err: unknown) {
      setPasswordError(getErrorMessage(err, 'Failed to update password.'))
    } finally {
      setPasswordSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
  if (error && !profile) return <Alert variant="error">{error}</Alert>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white/90">My Profile</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">View and update your personal information.</p>
        </div>
        {!editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={<KeyRound className="h-4 w-4" />}
              onClick={handleTogglePasswordForm}
            >
              {showPasswordForm ? 'Close Password Form' : 'Change Password'}
            </Button>
            <Button onClick={() => setEditing(true)}>Edit Profile</Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} icon={<Save className="h-4 w-4" />}>Save Changes</Button>
          </div>
        )}
      </div>

      {success && <Alert variant="success">{success}</Alert>}
      {error && profile && <Alert variant="error">{error}</Alert>}

      {showPasswordForm && (
        <Card>
          <CardHeader
            title="Change Password"
            description="Enter your current password and choose a new one."
          />

          <div className="space-y-4">
            {passwordSuccess && <Alert variant="success">{passwordSuccess}</Alert>}
            {passwordError && <Alert variant="error">{passwordError}</Alert>}

            <Input
              type="password"
              label="Current Password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
              autoComplete="current-password"
            />
            <Input
              type="password"
              label="New Password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
              helperText="Use at least 6 characters."
              autoComplete="new-password"
            />
            <Input
              type="password"
              label="Confirm New Password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              autoComplete="new-password"
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={hidePasswordForm}
                disabled={passwordSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleChangePassword()}
                loading={passwordSaving}
                icon={<KeyRound className="h-4 w-4" />}
              >
                Update Password
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Profile header card */}
      <Card>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Avatar name={profile?.full_name ?? '?'} size="lg" />
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white/90">{profile?.full_name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{profile?.email}</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2">
              <Badge variant="primary">Faculty</Badge>
              {profile?.position && <Badge variant="default">{profile.position}</Badge>}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal info */}
        <Card>
          <CardHeader title="Personal Information" description={editing ? 'Update your details below' : 'Your personal details'} />
          {editing ? (
            <div className="space-y-4">
              <Input
                label="First Name"
                value={form.first_name ?? ''}
                onChange={(e) => setForm(f => ({ ...f, first_name: e.target.value }))}
              />
              <Input
                label="Middle Name"
                value={form.middle_name ?? ''}
                onChange={(e) => setForm(f => ({ ...f, middle_name: e.target.value }))}
              />
              <Input
                label="Last Name"
                value={form.last_name ?? ''}
                onChange={(e) => setForm(f => ({ ...f, last_name: e.target.value }))}
              />
              <Input
                label="Address"
                value={form.address ?? ''}
                onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))}
              />
              <Input
                label="Other Designation"
                value={form.other_designation ?? ''}
                onChange={(e) => setForm(f => ({ ...f, other_designation: e.target.value }))}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <InfoRow icon={User} label="Full Name" value={profile?.full_name ?? '—'} />
              <InfoRow icon={Mail} label="Email" value={profile?.email ?? '—'} />
              <InfoRow icon={IdCard} label="Username" value={profile?.username ?? '—'} />
              <InfoRow icon={MapPin} label="Address" value={profile?.address ?? '—'} />
              <InfoRow icon={Briefcase} label="Other Designation" value={profile?.other_designation ?? '—'} />
            </div>
          )}
        </Card>

        {/* Academic info */}
        <Card>
          <CardHeader title="Academic Information" description="Your institutional details" />
          <div className="space-y-3">
            <InfoRow icon={IdCard} label="Employee ID" value={profile?.employee_id ?? '—'} />
            <InfoRow icon={Briefcase} label="Position" value={profile?.position ?? '—'} />
            <InfoRow icon={Building} label="Department" value={profile?.department?.name ?? '—'} />
            <InfoRow icon={BookOpen} label="College" value={profile?.college?.name ?? '—'} />
          </div>
        </Card>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
      <div>
        <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900 dark:text-white/90">{value}</p>
      </div>
    </div>
  )
}
