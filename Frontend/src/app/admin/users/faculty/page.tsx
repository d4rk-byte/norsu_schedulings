'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, Pencil, Filter } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchBar } from '@/components/ui/SearchBar'
import { Pagination } from '@/components/ui/Pagination'
import { Badge } from '@/components/ui/Badge'
import { useCrudList } from '@/hooks/useCrudList'
import { usersApi, collegesApi, departmentsApi } from '@/lib/admin-api'
import { ROLES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { User, College, Department } from '@/types'

export default function FacultyUsersPage() {
  const router = useRouter()
  const list = useCrudList<User>((p) => usersApi.list({ ...p, role: ROLES.FACULTY }))

  // Filter state
  const [colleges, setColleges] = useState<College[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedCollege, setSelectedCollege] = useState<string>('')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')

  useEffect(() => {
    collegesApi.list({ limit: 200 }).then(r => setColleges(r.data)).catch(() => {})
    departmentsApi.list({ limit: 200 }).then(r => setDepartments(r.data)).catch(() => {})
  }, [])

  const filteredDepts = useMemo(
    () => (selectedCollege ? departments.filter(d => d.college?.id === Number(selectedCollege)) : departments),
    [departments, selectedCollege],
  )

  useEffect(() => {
    const params: Record<string, unknown> = {}
    if (selectedCollege) params.college_id = selectedCollege
    if (selectedDepartment) params.department_id = selectedDepartment
    list.setExtraParams(params)
  }, [selectedCollege, selectedDepartment]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleCollegeChange(value: string) {
    setSelectedCollege(value)
    setSelectedDepartment('')
  }

  function clearFilters() {
    setSelectedCollege('')
    setSelectedDepartment('')
  }

  const columns: Column<User>[] = [
    { key: 'fullName', header: 'Name', sortable: true, render: (u) => <span className="font-medium text-gray-900 dark:text-white">{u.fullName}</span> },
    { key: 'email', header: 'Email', sortable: true, render: (u) => u.email },
    { key: 'college', header: 'College', render: (u) => u.college?.name || '—' },
    { key: 'department', header: 'Department', render: (u) => u.department?.name || '—' },
    { key: 'position', header: 'Position', render: (u) => u.position || '—' },
    { key: 'isActive', header: 'Status', sortable: true, render: (u) => <Badge variant={u.isActive ? 'success' : 'default'}>{u.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'createdAt', header: 'Joined', sortable: true, render: (u) => u.createdAt ? formatDate(u.createdAt) : '—' },
    {
      key: 'actions', header: '', className: 'w-10',
      render: (u) => (
        <div className="flex items-center gap-1">
          <Link href={`/admin/users/${u.id}`} onClick={e => e.stopPropagation()} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Eye className="h-4 w-4 text-gray-500" /></Link>
          <Link href={`/admin/users/${u.id}/edit`} onClick={e => e.stopPropagation()} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Pencil className="h-4 w-4 text-gray-500" /></Link>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900 dark:text-white">Faculty Members</h1><p className="mt-1 text-sm text-gray-500">Faculty users in the system.</p></div>
      <Card>
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search faculty..." className="max-w-sm" />
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
              {(selectedCollege || selectedDepartment) && (
                <button onClick={clearFilters} className="text-sm text-primary-600 hover:text-primary-800 whitespace-nowrap">
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
        <DataTable columns={columns} data={list.data} keyExtractor={(u) => u.id} loading={list.loading} sort={list.sort} onSort={list.setSort} onRowClick={(u) => router.push(`/admin/users/${u.id}`)} emptyTitle="No faculty found" />
        <Pagination className="mt-4" currentPage={list.page} totalPages={list.meta.totalPages} totalItems={list.meta.total} pageSize={list.meta.limit} onPageChange={list.setPage} />
      </Card>
    </div>
  )
}
