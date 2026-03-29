'use client'

import { useRouter } from 'next/navigation'
import { Building2, ChevronRight, Search } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { collegesApi, departmentsApi } from '@/lib/admin-api'
import type { College, Department } from '@/types'

export default function SchedulesPage() {
  const router = useRouter()
  const [colleges, setColleges] = useState<College[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedCollegeId, setSelectedCollegeId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [colRes, deptRes] = await Promise.all([
          collegesApi.list({ limit: 100 }),
          departmentsApi.list({ limit: 100 }),
        ])
        setColleges(colRes.data)
        setDepartments(deptRes.data)
      } catch { /* */ }
      setLoading(false)
    }
    load()
  }, [])

  const collegeOptions = useMemo(
    () => [{ value: '', label: 'All Colleges' }, ...colleges.map(c => ({ value: String(c.id), label: `${c.code} - ${c.name}` }))],
    [colleges],
  )

  const filteredDepartments = useMemo(() => {
    let list = departments
    if (selectedCollegeId) list = list.filter(d => d.college && String(d.college.id) === selectedCollegeId)
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      list = list.filter(d => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q) || (d.college?.name ?? '').toLowerCase().includes(q))
    }
    return list
  }, [departments, selectedCollegeId, searchTerm])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Schedule Management</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Select a college and department to manage schedules</p>
      </div>

      {/* College Filter & Search */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Select
            value={selectedCollegeId}
            onChange={e => setSelectedCollegeId(e.target.value)}
            options={collegeOptions}
            className="w-72 text-sm"
          />
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search departments..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </Card>

      {/* Department Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredDepartments.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Building2 className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">No departments found</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {searchTerm || selectedCollegeId ? 'Try adjusting your filters.' : 'Please create departments first before scheduling.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDepartments.map(dept => (
            <button
              key={dept.id}
              onClick={() => router.push(`/admin/schedules/department/${dept.id}`)}
              className="group text-left bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm hover:border-blue-500 dark:hover:border-blue-600 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-14 h-14 bg-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Building2 className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 transition-colors">
                    {dept.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {dept.college?.name ?? 'No College'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{dept.code}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
