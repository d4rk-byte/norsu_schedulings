'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Eye, Pencil, Trash2, ToggleLeft, ToggleRight, Filter, RotateCcw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchBar } from '@/components/ui/SearchBar'
import { Pagination } from '@/components/ui/Pagination'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { ConfirmModal } from '@/components/ui/Modal'
import { useCrudList } from '@/hooks/useCrudList'
import { usersApi, collegesApi, departmentsApi } from '@/lib/admin-api'
import { ROLE_LABELS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { User, College, Department } from '@/types'

function roleBadgeVariant(role: number) {
  if (role === 1) return 'danger' as const
  if (role === 2) return 'warning' as const
  return 'primary' as const
}

export default function AllUsersPage() {
  const router = useRouter()
  const list = useCrudList<User>(usersApi.list)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deletingPermanently, setDeletingPermanently] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Filter state
  const [colleges, setColleges] = useState<College[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [filteredDepts, setFilteredDepts] = useState<Department[]>([])
  const [selectedCollege, setSelectedCollege] = useState<string>('')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [includeDeleted, setIncludeDeleted] = useState(false)

  // Load colleges and departments for dropdowns
  useEffect(() => {
    collegesApi.list({ limit: 200 }).then(r => setColleges(r.data)).catch(() => {})
    departmentsApi.list({ limit: 200 }).then(r => setDepartments(r.data)).catch(() => {})
  }, [])

  // Filter departments when college changes
  useEffect(() => {
    if (selectedCollege) {
      setFilteredDepts(departments.filter(d => d.college?.id === Number(selectedCollege)))
    } else {
      setFilteredDepts(departments)
    }
  }, [selectedCollege, departments])

  // Apply filters via extraParams
  useEffect(() => {
    const params: Record<string, unknown> = {}
    if (selectedCollege) params.college_id = selectedCollege
    if (selectedDepartment) params.department_id = selectedDepartment
    if (selectedRole) params.role = selectedRole
    if (includeDeleted) params.include_deleted = 1
    list.setExtraParams(params)
  }, [selectedCollege, selectedDepartment, selectedRole, includeDeleted]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleCollegeChange(value: string) {
    setSelectedCollege(value)
    setSelectedDepartment('') // Reset department when college changes
  }

  function clearFilters() {
    setSelectedCollege('')
    setSelectedDepartment('')
    setSelectedRole('')
    setIncludeDeleted(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try { await usersApi.delete(deleteTarget.id); setDeleteTarget(null); list.refresh() } catch { setActionError('Failed to delete user.') } finally { setDeleting(false) }
  }

  async function restoreUser(user: User) {
    try {
      await usersApi.restore(user.id)
      list.refresh()
    } catch {
      setActionError('Failed to restore user.')
    }
  }

  async function handlePermanentDelete() {
    if (!permanentDeleteTarget) return
    setDeletingPermanently(true)
    try {
      await usersApi.deletePermanently(permanentDeleteTarget.id)
      setPermanentDeleteTarget(null)
      list.refresh()
    } catch {
      setActionError('Failed to permanently delete user.')
    } finally {
      setDeletingPermanently(false)
    }
  }

  async function toggleStatus(user: User) {
    try {
      if (user.isActive) { await usersApi.deactivate(user.id) } else { await usersApi.activate(user.id) }
      list.refresh()
    } catch { setActionError('Failed to update status.') }
  }

  const columns: Column<User>[] = [
    { key: 'fullName', header: 'Name', sortable: true, render: (u) => <span className="font-medium text-gray-900 dark:text-white">{u.fullName}</span> },
    { key: 'email', header: 'Email', sortable: true, render: (u) => u.email },
    { key: 'role', header: 'Role', render: (u) => <Badge variant={roleBadgeVariant(u.role)}>{ROLE_LABELS[u.role] || 'Unknown'}</Badge> },
    { key: 'college', header: 'College', render: (u) => u.college?.name || '—' },
    { key: 'department', header: 'Department', render: (u) => u.department?.name || '—' },
    {
      key: 'isActive',
      header: 'Status',
      sortable: true,
      render: (u) => {
        if (u.deletedAt) {
          return <Badge variant="danger">Deleted</Badge>
        }
        return <Badge variant={u.isActive ? 'success' : 'default'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
      },
    },
    { key: 'createdAt', header: 'Joined', sortable: true, render: (u) => u.createdAt ? formatDate(u.createdAt) : '—' },
    {
      key: 'actions', header: '', className: 'w-10',
      render: (u) => (
        <div className="flex items-center gap-1">
          <Link href={`/admin/users/${u.id}`} onClick={e => e.stopPropagation()} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Eye className="h-4 w-4 text-gray-500" /></Link>
          {u.deletedAt ? (
            <>
              <button onClick={(e) => { e.stopPropagation(); restoreUser(u) }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Restore user">
                <RotateCcw className="h-4 w-4 text-emerald-600" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setPermanentDeleteTarget(u) }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Delete permanently">
                <Trash2 className="h-4 w-4 text-red-600" />
              </button>
            </>
          ) : (
            <>
              <Link href={`/admin/users/${u.id}/edit`} onClick={e => e.stopPropagation()} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Pencil className="h-4 w-4 text-gray-500" /></Link>
              <button onClick={(e) => { e.stopPropagation(); toggleStatus(u) }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                {u.isActive ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4 text-gray-400" />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(u) }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Trash2 className="h-4 w-4 text-red-500" /></button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold text-gray-900 dark:text-white">All Users</h1><p className="mt-1 text-sm text-gray-500">Manage all system users.</p></div>
        <Link href="/admin/users/create"><Button icon={<Plus className="h-4 w-4" />}>Add User</Button></Link>
      </div>

      {actionError && <Alert variant="error" onDismiss={() => setActionError(null)}>{actionError}</Alert>}

      <Card>
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search users..." className="max-w-sm" />
            <div className="flex items-center gap-2 ml-auto">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={selectedCollege}
                onChange={(e) => handleCollegeChange(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              >
                <option value="">All Colleges</option>
                {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              >
                <option value="">All Departments</option>
                {filteredDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              >
                <option value="">All Roles</option>
                <option value="1">Admin</option>
                <option value="2">Department Head</option>
                <option value="3">Faculty</option>
              </select>
              <label className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-100">
                <input
                  type="checkbox"
                  checked={includeDeleted}
                  onChange={(e) => setIncludeDeleted(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Show deleted users
              </label>
              {(selectedCollege || selectedDepartment || selectedRole || includeDeleted) && (
                <button onClick={clearFilters} className="text-sm text-primary-600 hover:text-primary-800 whitespace-nowrap">
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
        <DataTable columns={columns} data={list.data} keyExtractor={(u) => u.id} loading={list.loading} sort={list.sort} onSort={list.setSort} onRowClick={(u) => router.push(`/admin/users/${u.id}`)} emptyTitle="No users found" emptyAction={<Link href="/admin/users/create"><Button size="sm" icon={<Plus className="h-4 w-4" />}>Add User</Button></Link>} />
        <Pagination className="mt-4" currentPage={list.page} totalPages={list.meta.totalPages} totalItems={list.meta.total} pageSize={list.meta.limit} onPageChange={list.setPage} />
      </Card>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting} title="Delete User" variant="danger" confirmLabel="Delete" message={`Are you sure you want to delete "${deleteTarget?.fullName}"? This is a soft delete and can be restored later from the "Show deleted users" list.`} />
      <ConfirmModal open={!!permanentDeleteTarget} onClose={() => setPermanentDeleteTarget(null)} onConfirm={handlePermanentDelete} loading={deletingPermanently} title="Delete Account Permanently" variant="danger" confirmLabel="Delete Permanently" message={`Are you sure you want to permanently delete "${permanentDeleteTarget?.fullName}"? This cannot be undone and will remove the account from the database.`} />
    </div>
  )
}
