'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, Pencil } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SearchBar } from '@/components/ui/SearchBar'
import { Pagination } from '@/components/ui/Pagination'
import { Badge } from '@/components/ui/Badge'
import { useCrudList } from '@/hooks/useCrudList'
import { usersApi } from '@/lib/admin-api'
import { ROLES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { User } from '@/types'

export default function AdministratorsPage() {
  const router = useRouter()
  const list = useCrudList<User>((p) => usersApi.list({ ...p, role: ROLES.ADMIN }))

  const columns: Column<User>[] = [
    { key: 'fullName', header: 'Name', sortable: true, render: (u) => <span className="font-medium text-gray-900 dark:text-white">{u.fullName}</span> },
    { key: 'email', header: 'Email', render: (u) => u.email },
    { key: 'isActive', header: 'Status', render: (u) => <Badge variant={u.isActive ? 'success' : 'default'}>{u.isActive ? 'Active' : 'Inactive'}</Badge> },
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
      <div><h1 className="text-3xl font-bold text-gray-900 dark:text-white">Administrators</h1><p className="mt-1 text-sm text-gray-500">Admin users in the system.</p></div>
      <Card>
        <div className="mb-4"><SearchBar value={list.search} onChange={list.setSearch} placeholder="Search administrators..." className="max-w-sm" /></div>
        <DataTable columns={columns} data={list.data} keyExtractor={(u) => u.id} loading={list.loading} sort={list.sort} onSort={list.setSort} onRowClick={(u) => router.push(`/admin/users/${u.id}`)} emptyTitle="No administrators found" />
        <Pagination className="mt-4" currentPage={list.page} totalPages={list.meta.totalPages} totalItems={list.meta.total} pageSize={list.meta.limit} onPageChange={list.setPage} />
      </Card>
    </div>
  )
}
