'use client'

import { useRouter } from 'next/navigation'
import { Plus, Eye, Edit, UserX, UserCheck } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchBar } from '@/components/ui/SearchBar'
import { Pagination } from '@/components/ui/Pagination'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { ConfirmModal, Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useCrudList } from '@/hooks/useCrudList'
import { dhFacultyApi } from '@/lib/department-head-api'
import { validateSafeEmployeeId, validateSafeUsername } from '@/lib/identity-validation'
import { POSITION_OPTIONS } from '@/lib/constants'
import type { User } from '@/types'
import { useState } from 'react'

interface CreateFacultyFormState {
  username: string
  email: string
  firstName: string
  middleName: string
  lastName: string
  password: string
  employeeId: string
  position: string
  address: string
}

interface EditFacultyFormState {
  username: string
  firstName: string
  middleName: string
  lastName: string
  email: string
  employeeId: string
  position: string
  address: string
}

const emptyCreateForm: CreateFacultyFormState = {
  username: '',
  email: '',
  firstName: '',
  middleName: '',
  lastName: '',
  password: '',
  employeeId: '',
  position: '',
  address: '',
}

const emptyEditForm: EditFacultyFormState = {
  username: '',
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  employeeId: '',
  position: '',
  address: '',
}

export default function DHFacultyListPage() {
  const router = useRouter()
  const list = useCrudList<User>((p) => dhFacultyApi.list(p))
  const [statusTarget, setStatusTarget] = useState<User | null>(null)
  const [toggling, setToggling] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [addFacultyOpen, setAddFacultyOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<CreateFacultyFormState>(emptyCreateForm)
  const [createErrors, setCreateErrors] = useState<Partial<Record<keyof CreateFacultyFormState, string>>>({})
  const [editFacultyOpen, setEditFacultyOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTarget, setEditTarget] = useState<User | null>(null)
  const [editForm, setEditForm] = useState<EditFacultyFormState>(emptyEditForm)
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof EditFacultyFormState, string>>>({})
  const [createChecking, setCreateChecking] = useState<{ username: boolean; employeeId: boolean }>({ username: false, employeeId: false })
  const [editChecking, setEditChecking] = useState<{ username: boolean; employeeId: boolean }>({ username: false, employeeId: false })
  const [createAvailableValues, setCreateAvailableValues] = useState<{ username: string; employeeId: string }>({ username: '', employeeId: '' })
  const [editAvailableValues, setEditAvailableValues] = useState<{ username: string; employeeId: string }>({ username: '', employeeId: '' })

  function setCreateField<K extends keyof CreateFacultyFormState>(key: K, value: CreateFacultyFormState[K]) {
    setCreateForm((prev) => ({ ...prev, [key]: value }))
    setCreateErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function setEditField<K extends keyof EditFacultyFormState>(key: K, value: EditFacultyFormState[K]) {
    setEditForm((prev) => ({ ...prev, [key]: value }))
    setEditErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function resetCreateModalState() {
    setCreateForm(emptyCreateForm)
    setCreateErrors({})
    setCreateChecking({ username: false, employeeId: false })
    setCreateAvailableValues({ username: '', employeeId: '' })
  }

  function resetEditModalState() {
    setEditForm(emptyEditForm)
    setEditErrors({})
    setEditChecking({ username: false, employeeId: false })
    setEditAvailableValues({ username: '', employeeId: '' })
    setEditTarget(null)
  }

  function openAddFacultyModal() {
    resetCreateModalState()
    setAddFacultyOpen(true)
  }

  function closeAddFacultyModal() {
    if (creating) return
    setAddFacultyOpen(false)
    resetCreateModalState()
  }

  function openEditFacultyModal(user: User) {
    setEditTarget(user)
    setEditForm({
      username: user.username || '',
      firstName: user.firstName || '',
      middleName: user.middleName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      employeeId: user.employeeId || '',
      position: user.position || '',
      address: user.address || '',
    })
    setEditErrors({})
    setEditAvailableValues({ username: user.username || '', employeeId: user.employeeId || '' })
    setEditFacultyOpen(true)
  }

  function isCreateFieldAvailable(field: 'username' | 'employeeId') {
    const currentValue = createForm[field].trim().toLowerCase()
    const availableValue = createAvailableValues[field].trim().toLowerCase()

    return Boolean(currentValue && currentValue === availableValue && !createChecking[field] && !createErrors[field])
  }

  function isEditFieldAvailable(field: 'username' | 'employeeId') {
    const currentValue = editForm[field].trim().toLowerCase()
    const availableValue = editAvailableValues[field].trim().toLowerCase()

    return Boolean(currentValue && currentValue === availableValue && !editChecking[field] && !editErrors[field])
  }

  function closeEditFacultyModal() {
    if (editing) return
    setEditFacultyOpen(false)
    resetEditModalState()
  }

  function validateCreateForm() {
    const errors: Partial<Record<keyof CreateFacultyFormState, string>> = {}
    if (!createForm.username.trim()) errors.username = 'Required'
    if (!createForm.email.trim()) errors.email = 'Required'
    if (!createForm.firstName.trim()) errors.firstName = 'Required'
    if (!createForm.lastName.trim()) errors.lastName = 'Required'
    if (!createForm.password.trim()) errors.password = 'Required'

    const usernameSafetyError = validateSafeUsername(createForm.username)
    if (usernameSafetyError) errors.username = usernameSafetyError

    const employeeIdSafetyError = validateSafeEmployeeId(createForm.employeeId)
    if (employeeIdSafetyError) errors.employeeId = employeeIdSafetyError

    setCreateErrors(errors)
    return Object.keys(errors).length === 0
  }

  function validateEditForm() {
    const errors: Partial<Record<keyof EditFacultyFormState, string>> = {}
    if (!editForm.username.trim()) errors.username = 'Required'
    if (!editForm.firstName.trim()) errors.firstName = 'Required'
    if (!editForm.lastName.trim()) errors.lastName = 'Required'
    if (!editForm.email.trim()) errors.email = 'Required'

    if (editTarget) {
      const usernameValue = editForm.username.trim()
      const originalUsername = (editTarget.username || '').trim()
      if (usernameValue.toLowerCase() !== originalUsername.toLowerCase()) {
        const usernameSafetyError = validateSafeUsername(usernameValue)
        if (usernameSafetyError) errors.username = usernameSafetyError
      }

      const employeeIdValue = editForm.employeeId.trim()
      const originalEmployeeId = (editTarget.employeeId || '').trim()
      if (employeeIdValue.toLowerCase() !== originalEmployeeId.toLowerCase()) {
        const employeeIdSafetyError = validateSafeEmployeeId(employeeIdValue)
        if (employeeIdSafetyError) errors.employeeId = employeeIdSafetyError
      }
    }

    setEditErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function checkAvailability(field: 'username' | 'employeeId', value: string) {
    const result = await dhFacultyApi.checkAvailability(field, value)
    if (result.available) {
      return null
    }
    if (result.message) {
      return result.message
    }
    return field === 'username' ? 'Username already taken.' : 'Employee ID already in use.'
  }

  async function validateCreateAvailabilityField(field: 'username' | 'employeeId') {
    const value = createForm[field].trim()

    if (!value) {
      setCreateErrors((prev) => ({ ...prev, [field]: undefined }))
      setCreateAvailableValues((prev) => ({ ...prev, [field]: '' }))
      return true
    }

    const safetyMessage = field === 'username'
      ? validateSafeUsername(value)
      : validateSafeEmployeeId(value)

    if (safetyMessage) {
      setCreateErrors((prev) => ({ ...prev, [field]: safetyMessage }))
      setCreateAvailableValues((prev) => ({ ...prev, [field]: '' }))
      return false
    }

    setCreateChecking((prev) => ({ ...prev, [field]: true }))
    try {
      const message = await checkAvailability(field, value)
      setCreateErrors((prev) => ({ ...prev, [field]: message || undefined }))
      setCreateAvailableValues((prev) => ({ ...prev, [field]: message ? '' : value }))
      return !message
    } catch {
      setCreateAvailableValues((prev) => ({ ...prev, [field]: '' }))
      return true
    } finally {
      setCreateChecking((prev) => ({ ...prev, [field]: false }))
    }
  }

  async function validateEditAvailabilityField(field: 'username' | 'employeeId') {
    if (!editTarget) {
      return true
    }

    const value = editForm[field].trim()
    const originalValue = field === 'username'
      ? (editTarget.username || '').trim()
      : (editTarget.employeeId || '').trim()

    const normalizedValue = value.toLowerCase()
    const normalizedOriginalValue = originalValue.toLowerCase()

    if (!value || normalizedValue === normalizedOriginalValue) {
      setEditErrors((prev) => ({ ...prev, [field]: undefined }))
      setEditAvailableValues((prev) => ({ ...prev, [field]: value }))
      return true
    }

    const safetyMessage = field === 'username'
      ? validateSafeUsername(value)
      : validateSafeEmployeeId(value)

    if (safetyMessage) {
      setEditErrors((prev) => ({ ...prev, [field]: safetyMessage }))
      setEditAvailableValues((prev) => ({ ...prev, [field]: '' }))
      return false
    }

    setEditChecking((prev) => ({ ...prev, [field]: true }))
    try {
      const message = await checkAvailability(field, value)
      setEditErrors((prev) => ({ ...prev, [field]: message || undefined }))
      setEditAvailableValues((prev) => ({ ...prev, [field]: message ? '' : value }))
      return !message
    } catch {
      setEditAvailableValues((prev) => ({ ...prev, [field]: '' }))
      return true
    } finally {
      setEditChecking((prev) => ({ ...prev, [field]: false }))
    }
  }

  async function validateCreateAvailability() {
    const [usernameOk, employeeIdOk] = await Promise.all([
      validateCreateAvailabilityField('username'),
      validateCreateAvailabilityField('employeeId'),
    ])

    return usernameOk && employeeIdOk
  }

  async function validateEditAvailability() {
    const [usernameOk, employeeIdOk] = await Promise.all([
      validateEditAvailabilityField('username'),
      validateEditAvailabilityField('employeeId'),
    ])

    return usernameOk && employeeIdOk
  }

  async function handleCreateFaculty(e: React.FormEvent) {
    e.preventDefault()
    if (!validateCreateForm()) return
    if (!(await validateCreateAvailability())) return

    setCreating(true)
    try {
      await dhFacultyApi.create({
        ...createForm,
        role: 3,
      })
      setFeedback({ type: 'success', msg: 'Faculty member created successfully.' })
      setAddFacultyOpen(false)
      resetCreateModalState()
      list.refresh()
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Failed to create faculty member.'
      setFeedback({ type: 'error', msg: message })
    } finally {
      setCreating(false)
    }
  }

  async function handleEditFaculty(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    if (!validateEditForm()) return
    if (!(await validateEditAvailability())) return

    setEditing(true)
    try {
      await dhFacultyApi.update(editTarget.id, editForm)
      setFeedback({ type: 'success', msg: 'Faculty member updated successfully.' })
      setEditFacultyOpen(false)
      resetEditModalState()
      list.refresh()
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Failed to update faculty member.'
      setFeedback({ type: 'error', msg: message })
    } finally {
      setEditing(false)
    }
  }

  async function generatePassword() {
    try {
      const result = await dhFacultyApi.generatePassword()
      setCreateField('password', result.password)
    } catch {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
      let pw = ''
      for (let i = 0; i < 12; i += 1) {
        pw += chars[Math.floor(Math.random() * chars.length)]
      }
      setCreateField('password', pw)
    }
  }

  async function handleToggleStatus() {
    if (!statusTarget) return
    setToggling(true)
    try {
      if (statusTarget.isActive) {
        await dhFacultyApi.deactivate(statusTarget.id)
      } else {
        await dhFacultyApi.activate(statusTarget.id)
      }
      setFeedback({ type: 'success', msg: `${statusTarget.fullName} has been ${statusTarget.isActive ? 'deactivated' : 'activated'}.` })
      list.refresh()
    } catch {
      setFeedback({ type: 'error', msg: 'Failed to update status.' })
    } finally {
      setToggling(false)
      setStatusTarget(null)
    }
  }

  const columns: Column<User>[] = [
    { key: 'fullName', header: 'Name', sortable: true, render: (u) => (
      <div>
        <span className="font-medium text-gray-900">{u.fullName}</span>
        {u.employeeId && <span className="text-xs text-gray-400 ml-2">{u.employeeId}</span>}
      </div>
    )},
    { key: 'email', header: 'Email', sortable: true },
    { key: 'position', header: 'Position', render: (u) => u.position || '—' },
    { key: 'isActive', header: 'Status', render: (u) => (
      <Badge variant={u.isActive ? 'success' : 'danger'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
    )},
    { key: 'lastLogin', header: 'Last Login', render: (u) => u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never' },
    { key: 'actions', header: '', render: (u) => (
      <div className="flex items-center gap-1">
        <button onClick={(e) => { e.stopPropagation(); router.push(`/department-head/faculty/${u.id}`) }} className="p-1.5 rounded hover:bg-gray-100" title="View"><Eye className="h-4 w-4 text-gray-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); openEditFacultyModal(u) }} className="p-1.5 rounded hover:bg-gray-100" title="Edit"><Edit className="h-4 w-4 text-gray-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); setStatusTarget(u) }} className="p-1.5 rounded hover:bg-gray-100" title={u.isActive ? 'Deactivate' : 'Activate'}>
          {u.isActive ? <UserX className="h-4 w-4 text-red-500" /> : <UserCheck className="h-4 w-4 text-green-500" />}
        </button>
      </div>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Faculty Members</h1>
          <p className="mt-1 text-sm text-gray-500">Manage faculty in your department</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openAddFacultyModal}>Add Faculty</Button>
      </div>

      {feedback && <Alert variant={feedback.type} onDismiss={() => setFeedback(null)}>{feedback.msg}</Alert>}
      {list.error && <Alert variant="error">{list.error}</Alert>}

      <Card>
        <div className="flex items-center gap-4 mb-4">
          <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search faculty..." className="max-w-sm" />
        </div>
        <DataTable columns={columns} data={list.data} keyExtractor={(u) => u.id} loading={list.loading} sort={list.sort} onSort={list.setSort} onRowClick={(u) => router.push(`/department-head/faculty/${u.id}`)} emptyTitle="No faculty found" />
        <Pagination className="mt-4" currentPage={list.page} totalPages={list.meta.totalPages} totalItems={list.meta.total} pageSize={list.meta.limit} onPageChange={list.setPage} />
      </Card>

      <ConfirmModal
        open={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={handleToggleStatus}
        loading={toggling}
        title={statusTarget?.isActive ? 'Deactivate Faculty' : 'Activate Faculty'}
        variant={statusTarget?.isActive ? 'danger' : 'primary'}
        confirmLabel={statusTarget?.isActive ? 'Deactivate' : 'Activate'}
        message={`Are you sure you want to ${statusTarget?.isActive ? 'deactivate' : 'activate'} "${statusTarget?.fullName}"?`}
      />

      <Modal
        open={addFacultyOpen}
        onClose={closeAddFacultyModal}
        title="Add Faculty Member"
        description="Create a new faculty account in your department"
        size="xl"
        closeOnOverlay={!creating}
      >
        <form onSubmit={handleCreateFaculty} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="First Name"
              required
              value={createForm.firstName}
              onChange={(e) => setCreateField('firstName', e.target.value)}
              error={createErrors.firstName}
            />
            <Input
              label="Middle Name"
              value={createForm.middleName}
              onChange={(e) => setCreateField('middleName', e.target.value)}
            />
            <Input
              label="Last Name"
              required
              value={createForm.lastName}
              onChange={(e) => setCreateField('lastName', e.target.value)}
              error={createErrors.lastName}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Username"
              required
              value={createForm.username}
              onChange={(e) => setCreateField('username', e.target.value)}
              onBlur={() => validateCreateAvailabilityField('username')}
              error={createErrors.username}
              success={isCreateFieldAvailable('username')}
              helperText={createChecking.username ? 'Checking username availability...' : undefined}
            />
            <Input
              label="Email"
              type="email"
              required
              value={createForm.email}
              onChange={(e) => setCreateField('email', e.target.value)}
              error={createErrors.email}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                label="Password"
                required
                value={createForm.password}
                onChange={(e) => setCreateField('password', e.target.value)}
                error={createErrors.password}
              />
              <button
                type="button"
                onClick={generatePassword}
                className="mt-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Generate Password
              </button>
            </div>
            <Input
              label="Employee ID"
              value={createForm.employeeId}
              onChange={(e) => setCreateField('employeeId', e.target.value)}
              onBlur={() => validateCreateAvailabilityField('employeeId')}
              placeholder="e.g. EMP-001"
              error={createErrors.employeeId}
              success={isCreateFieldAvailable('employeeId')}
              helperText={createChecking.employeeId ? 'Checking employee ID availability...' : undefined}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Position"
              value={createForm.position}
              onChange={(e) => setCreateField('position', e.target.value)}
              options={[{ value: '', label: '-- Select Position --' }, ...POSITION_OPTIONS]}
            />
            <Input
              label="Address"
              value={createForm.address}
              onChange={(e) => setCreateField('address', e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={closeAddFacultyModal} disabled={creating}>Cancel</Button>
            <Button type="submit" loading={creating}>Create Faculty</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editFacultyOpen}
        onClose={closeEditFacultyModal}
        title="Edit Faculty Member"
        description={editTarget ? `Update details for ${editTarget.fullName}` : 'Update faculty information'}
        size="xl"
        closeOnOverlay={!editing}
      >
        <form onSubmit={handleEditFaculty} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="First Name"
              required
              value={editForm.firstName}
              onChange={(e) => setEditField('firstName', e.target.value)}
              error={editErrors.firstName}
            />
            <Input
              label="Middle Name"
              value={editForm.middleName}
              onChange={(e) => setEditField('middleName', e.target.value)}
            />
            <Input
              label="Last Name"
              required
              value={editForm.lastName}
              onChange={(e) => setEditField('lastName', e.target.value)}
              error={editErrors.lastName}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Username"
              required
              value={editForm.username}
              onChange={(e) => setEditField('username', e.target.value)}
              onBlur={() => validateEditAvailabilityField('username')}
              error={editErrors.username}
              success={isEditFieldAvailable('username')}
              helperText={editChecking.username ? 'Checking username availability...' : undefined}
            />
            <Input
              label="Email"
              type="email"
              required
              value={editForm.email}
              onChange={(e) => setEditField('email', e.target.value)}
              error={editErrors.email}
            />
            <Input
              label="Employee ID"
              value={editForm.employeeId}
              onChange={(e) => setEditField('employeeId', e.target.value)}
              onBlur={() => validateEditAvailabilityField('employeeId')}
              placeholder="e.g. EMP-001"
              error={editErrors.employeeId}
              success={isEditFieldAvailable('employeeId')}
              helperText={editChecking.employeeId ? 'Checking employee ID availability...' : undefined}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Position"
              value={editForm.position}
              onChange={(e) => setEditField('position', e.target.value)}
              options={[{ value: '', label: '-- Select Position --' }, ...POSITION_OPTIONS]}
            />
            <Input
              label="Address"
              value={editForm.address}
              onChange={(e) => setEditField('address', e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={closeEditFacultyModal} disabled={editing}>Cancel</Button>
            <Button type="submit" loading={editing}>Save Changes</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
