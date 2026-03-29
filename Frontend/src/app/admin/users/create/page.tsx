'use client'

import { useState, useEffect, useMemo, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Alert } from '@/components/ui/Alert'
import { usersApi, collegesApi, departmentsApi } from '@/lib/admin-api'
import { validateSafeEmployeeId, validateSafeUsername } from '@/lib/identity-validation'
import { ROLES, ROLE_LABELS, POSITION_OPTIONS } from '@/lib/constants'
import type { UserCreateInput } from '@/types'
import type { Department } from '@/types/department'
import type { AxiosError } from 'axios'

export default function CreateUserPage() {
  const router = useRouter()
  const [form, setForm] = useState<UserCreateInput>({ username: '', email: '', password: '', role: ROLES.FACULTY })
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [checking, setChecking] = useState<Record<'username' | 'employeeId', boolean>>({ username: false, employeeId: false })
  const [availableValues, setAvailableValues] = useState<Record<'username' | 'employeeId', string>>({ username: '', employeeId: '' })
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)
  const [colleges, setColleges] = useState<{ id: number; name: string }[]>([])
  const [departments, setDepartments] = useState<Department[]>([])

  useEffect(() => {
    Promise.all([
      collegesApi.list({ limit: 200 }),
      departmentsApi.list({ limit: 200 }),
    ]).then(([c, d]) => {
      setColleges(c.data)
      setDepartments(d.data)
    })
  }, [])

  const set = (field: string, value: unknown) => setForm(prev => ({ ...prev, [field]: value }))

  const filteredDepartments = useMemo(() => {
    if (!form.collegeId) return departments
    return departments.filter((d) => d.college?.id === form.collegeId)
  }, [departments, form.collegeId])

  function setFieldError(field: 'username' | 'employeeId', message?: string) {
    setErrors((prev) => {
      const next = { ...prev }
      if (message) next[field] = message
      else delete next[field]
      return next
    })
  }

  function isFieldAvailable(field: 'username' | 'employeeId') {
    const currentValue = (form[field] || '').trim().toLowerCase()
    const availableValue = (availableValues[field] || '').trim().toLowerCase()

    return Boolean(currentValue && currentValue === availableValue && !checking[field] && !errors[field])
  }

  async function checkAvailability(field: 'username' | 'employeeId', value: string) {
    const result = await usersApi.checkAvailability(field, value)
    if (result.available) {
      return null
    }
    if (result.message) {
      return result.message
    }
    return field === 'username' ? 'Username already taken.' : 'Employee ID already in use.'
  }

  async function validateAvailabilityField(field: 'username' | 'employeeId') {
    const value = (form[field] || '').trim()

    if (!value) {
      setFieldError(field)
      setAvailableValues((prev) => ({ ...prev, [field]: '' }))
      return true
    }

    const safetyMessage = field === 'username'
      ? validateSafeUsername(value)
      : validateSafeEmployeeId(value)

    if (safetyMessage) {
      setFieldError(field, safetyMessage)
      setAvailableValues((prev) => ({ ...prev, [field]: '' }))
      return false
    }

    setChecking((prev) => ({ ...prev, [field]: true }))
    try {
      const message = await checkAvailability(field, value)
      setFieldError(field, message || undefined)
      setAvailableValues((prev) => ({ ...prev, [field]: message ? '' : value }))
      return !message
    } catch {
      setAvailableValues((prev) => ({ ...prev, [field]: '' }))
      return true
    } finally {
      setChecking((prev) => ({ ...prev, [field]: false }))
    }
  }

  async function validateAvailability() {
    const [usernameOk, employeeIdOk] = await Promise.all([
      validateAvailabilityField('username'),
      validateAvailabilityField('employeeId'),
    ])

    return usernameOk && employeeIdOk
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.username.trim()) e.username = 'Username is required.'
    if (!form.email.trim()) e.email = 'Email is required.'
    if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters.'
    if (!form.role) e.role = 'Role is required.'

    const usernameSafetyError = validateSafeUsername(form.username)
    if (usernameSafetyError) e.username = usernameSafetyError

    const employeeIdSafetyError = validateSafeEmployeeId(form.employeeId || '')
    if (employeeIdSafetyError) e.employeeId = employeeIdSafetyError

    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    if (!(await validateAvailability())) return
    setSaving(true)
    setServerError('')
    try {
      await usersApi.create(form)
      router.push('/admin/users')
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ error?: { message?: string; details?: Record<string, string> } }>
      const respData = axiosErr?.response?.data
      if (respData?.error?.details) {
        setErrors(respData.error.details)
      }
      const msg = respData?.error?.message || (err instanceof Error ? err.message : 'Failed to create user.')
      setServerError(msg)
    } finally {
      setSaving(false)
    }
  }

  const roleOptions = Object.entries(ROLE_LABELS).map(([v, l]) => ({ value: v, label: l }))
  const collegeOptions = colleges.map(c => ({ value: String(c.id), label: c.name }))
  const deptOptions = filteredDepartments.map(d => ({ value: String(d.id), label: d.name }))

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/users" className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create User</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Add a new user to the system.</p>
        </div>
      </div>
      {serverError && <Alert variant="error">{serverError}</Alert>}
      <Card>
        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-4xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Username"
              required
              value={form.username}
              onChange={e => set('username', e.target.value)}
              onBlur={() => validateAvailabilityField('username')}
              error={errors.username}
              success={isFieldAvailable('username')}
              helperText={checking.username ? 'Checking username availability...' : undefined}
            />
            <Input label="Email" type="email" required value={form.email} onChange={e => set('email', e.target.value)} error={errors.email} />
          </div>
          <Input label="Password" type="password" required value={form.password} onChange={e => set('password', e.target.value)} error={errors.password} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="First Name" value={form.firstName || ''} onChange={e => set('firstName', e.target.value)} />
            <Input label="Middle Name" value={form.middleName || ''} onChange={e => set('middleName', e.target.value)} />
            <Input label="Last Name" value={form.lastName || ''} onChange={e => set('lastName', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Role" required value={String(form.role)} onChange={(e) => set('role', Number(e.target.value))} options={roleOptions} error={errors.role} />
            <Input
              label="Employee ID"
              value={form.employeeId || ''}
              onChange={e => set('employeeId', e.target.value)}
              onBlur={() => validateAvailabilityField('employeeId')}
              error={errors.employeeId}
              success={isFieldAvailable('employeeId')}
              helperText={checking.employeeId ? 'Checking employee ID availability...' : undefined}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="College"
              value={form.collegeId ? String(form.collegeId) : ''}
              onChange={(e) => {
                const nextCollegeId = e.target.value ? Number(e.target.value) : undefined
                const currentDepartment = departments.find((d) => d.id === form.departmentId)
                const departmentBelongsToCollege = !!(nextCollegeId && currentDepartment?.college?.id === nextCollegeId)

                setForm((prev) => ({
                  ...prev,
                  collegeId: nextCollegeId,
                  departmentId: departmentBelongsToCollege ? prev.departmentId : undefined,
                }))
              }}
              options={[{ value: '', label: '-- None --' }, ...collegeOptions]}
              error={errors.collegeId}
            />
            <Select
              label="Department"
              value={form.departmentId ? String(form.departmentId) : ''}
              onChange={(e) => set('departmentId', e.target.value ? Number(e.target.value) : undefined)}
              options={[{ value: '', label: '-- None --' }, ...deptOptions]}
              error={errors.departmentId}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Position"
              value={form.position || ''}
              onChange={(e) => set('position', e.target.value || undefined)}
              options={[{ value: '', label: '-- Select Position --' }, ...POSITION_OPTIONS]}
            />
            <Input label="Other Designation" value={form.otherDesignation || ''} onChange={e => set('otherDesignation', e.target.value)} />
          </div>
          <Input label="Address" value={form.address || ''} onChange={e => set('address', e.target.value)} />
          <div className="flex justify-end gap-3 pt-4">
            <Link href="/admin/users"><Button variant="secondary">Cancel</Button></Link>
            <Button type="submit" disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Create User'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
