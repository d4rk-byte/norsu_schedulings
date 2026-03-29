'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Eye, RefreshCw, SlidersHorizontal, XCircle } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { SearchBar } from '@/components/ui/SearchBar'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import {
  adminScheduleChangeRequestsApi,
  departmentsApi,
  type ScheduleChangeRequestListParams,
  type ScheduleChangeRequestReviewPayload,
} from '@/lib/admin-api'
import { formatTime } from '@/lib/utils'
import type { Department, ScheduleChangeRequest } from '@/types'

const PAGE_SIZE = 10

type ReviewAction = 'approve' | 'reject' | null

type StatusOption = {
  value: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'all'
  label: string
}

type ApprovalStatusOption = {
  value: 'pending' | 'approved' | 'rejected' | 'all'
  label: string
}

type RequestSnapshotRoom = {
  code?: string | null
  name?: string | null
}

type RequestSnapshot = {
  day_pattern?: string | null
  start_time?: string | null
  end_time?: string | null
  section?: string | null
  room?: RequestSnapshotRoom | null
}

type RequestedChangesSnapshot = {
  from?: RequestSnapshot | null
  to?: RequestSnapshot | null
}

const requestStatusOptions: StatusOption[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All Statuses' },
]

const reviewStatusOptions: ApprovalStatusOption[] = [
  { value: 'pending', label: 'Pending Review' },
  { value: 'approved', label: 'Reviewed: Approved' },
  { value: 'rejected', label: 'Reviewed: Rejected' },
  { value: 'all', label: 'All Review Statuses' },
]

function requestStatusVariant(status: string): 'default' | 'success' | 'warning' | 'danger' {
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'danger'
  if (status === 'cancelled') return 'default'
  return 'warning'
}

function approvalStatusVariant(status: string): 'default' | 'success' | 'warning' | 'danger' {
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'danger'
  return 'warning'
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatTimeSafe(value: string | null | undefined): string {
  if (!value) return '—'

  const normalized = value.includes(':') ? value.slice(0, 5) : value
  return formatTime(normalized)
}

function formatTimeRange(startTime: string | null | undefined, endTime: string | null | undefined): string {
  if (!startTime || !endTime) return '—'
  return `${formatTimeSafe(startTime)} - ${formatTimeSafe(endTime)}`
}

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

function getRequestSnapshots(request: ScheduleChangeRequest): { from: RequestSnapshot | null; to: RequestSnapshot | null } {
  if (!request.requestedChanges || typeof request.requestedChanges !== 'object') {
    return { from: null, to: null }
  }

  const snapshots = request.requestedChanges as RequestedChangesSnapshot

  return {
    from: snapshots.from && typeof snapshots.from === 'object' ? snapshots.from : null,
    to: snapshots.to && typeof snapshots.to === 'object' ? snapshots.to : null,
  }
}

export default function AdminScheduleChangeRequestsPage() {
  const [items, setItems] = useState<ScheduleChangeRequest[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<StatusOption['value']>('pending')
  const [reviewFilter, setReviewFilter] = useState<ApprovalStatusOption['value']>('pending')
  const [collegeFilter, setCollegeFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [isScopeFilterModalOpen, setIsScopeFilterModalOpen] = useState(false)
  const [draftCollegeFilter, setDraftCollegeFilter] = useState('all')
  const [draftDepartmentFilter, setDraftDepartmentFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [selectedRequest, setSelectedRequest] = useState<ScheduleChangeRequest | null>(null)
  const [pendingAction, setPendingAction] = useState<ReviewAction>(null)
  const [comment, setComment] = useState('')

  const canReview = useCallback((request: ScheduleChangeRequest): boolean => {
    if (typeof request.canAdminReview === 'boolean') return request.canAdminReview
    return request.status === 'pending' && request.adminStatus === 'pending'
  }, [])

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError(null)

    const params: ScheduleChangeRequestListParams = {
      status: statusFilter,
      admin_status: reviewFilter,
      limit: 200,
    }

    try {
      const data = await adminScheduleChangeRequestsApi.list(params)
      setItems(data)
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, 'Failed to load schedule change requests.'))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [reviewFilter, statusFilter])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  useEffect(() => {
    let mounted = true

    const loadDepartments = async () => {
      try {
        const response = await departmentsApi.list({ limit: 500 })
        if (!mounted) return
        setDepartments(response.data || [])
      } catch {
        if (!mounted) return
        setDepartments([])
      }
    }

    void loadDepartments()

    return () => {
      mounted = false
    }
  }, [])

  const collegeOptions = useMemo(() => {
    const byCollegeId = new Map<number, string>()

    departments.forEach((department) => {
      if (department.college?.id && department.college.name) {
        byCollegeId.set(department.college.id, department.college.name)
      }
    })

    return [
      { value: 'all', label: 'All Colleges' },
      ...Array.from(byCollegeId.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([id, name]) => ({ value: String(id), label: name })),
    ]
  }, [departments])

  const getDepartmentOptions = useCallback((selectedCollegeFilter: string) => {
    const scopedDepartments = selectedCollegeFilter === 'all'
      ? departments
      : departments.filter((department) => String(department.college?.id ?? '') === selectedCollegeFilter)

    return [
      { value: 'all', label: 'All Departments' },
      ...scopedDepartments
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((department) => ({ value: String(department.id), label: department.name })),
    ]
  }, [departments])

  const draftDepartmentOptions = useMemo(() => getDepartmentOptions(draftCollegeFilter), [draftCollegeFilter, getDepartmentOptions])

  const activeScopeFilterCount = useMemo(() => {
    return Number(collegeFilter !== 'all') + Number(departmentFilter !== 'all')
  }, [collegeFilter, departmentFilter])

  useEffect(() => {
    if (departmentFilter === 'all' || collegeFilter === 'all') return

    const selectedDepartment = departments.find((department) => String(department.id) === departmentFilter)
    const selectedCollegeId = selectedDepartment?.college?.id

    if (!selectedDepartment || String(selectedCollegeId ?? '') !== collegeFilter) {
      setDepartmentFilter('all')
    }
  }, [collegeFilter, departmentFilter, departments])

  useEffect(() => {
    if (draftDepartmentFilter === 'all' || draftCollegeFilter === 'all') return

    const selectedDepartment = departments.find((department) => String(department.id) === draftDepartmentFilter)
    const selectedCollegeId = selectedDepartment?.college?.id

    if (!selectedDepartment || String(selectedCollegeId ?? '') !== draftCollegeFilter) {
      setDraftDepartmentFilter('all')
    }
  }, [departments, draftCollegeFilter, draftDepartmentFilter])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, reviewFilter, collegeFilter, departmentFilter])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    const departmentToCollegeMap = new Map<number, number | null>()

    departments.forEach((department) => {
      departmentToCollegeMap.set(department.id, department.college?.id ?? null)
    })

    return items.filter((request) => {
      const schedule = request.schedule
      const parts = [
        request.requester?.fullName,
        request.requester?.email,
        request.subjectDepartment?.name,
        request.subjectDepartment?.code,
        schedule?.subject.code,
        schedule?.subject.title,
        schedule?.section,
        request.proposal.section,
      ]

      const haystack = parts.filter(Boolean).join(' ').toLowerCase()
      const requesterDepartmentId = request.requester?.department?.id ?? null
      const subjectDepartmentId = request.subjectDepartment?.id ?? null
      const effectiveDepartmentId = requesterDepartmentId ?? subjectDepartmentId

      const matchesSearch = query === '' || haystack.includes(query)
      const matchesDepartment = departmentFilter === 'all'
        || (effectiveDepartmentId !== null && String(effectiveDepartmentId) === departmentFilter)

      const matchesCollege = collegeFilter === 'all'
        || (
          effectiveDepartmentId !== null
          && String(departmentToCollegeMap.get(effectiveDepartmentId) ?? '') === collegeFilter
        )

      return matchesSearch && matchesDepartment && matchesCollege
    })
  }, [collegeFilter, departmentFilter, departments, items, search])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredItems.slice(start, start + PAGE_SIZE)
  }, [currentPage, filteredItems])

  const requestedChangesText = useMemo(() => {
    if (!selectedRequest?.requestedChanges) return ''

    try {
      return JSON.stringify(selectedRequest.requestedChanges, null, 2)
    } catch {
      return ''
    }
  }, [selectedRequest])

  function openDetails(request: ScheduleChangeRequest) {
    setSelectedRequest(request)
    setPendingAction(null)
    setComment('')
  }

  function openDecision(request: ScheduleChangeRequest, action: Exclude<ReviewAction, null>) {
    setSelectedRequest(request)
    setPendingAction(action)
    setComment('')
    setError(null)
    setFeedback(null)
  }

  function closeModal() {
    if (submitting) return
    setSelectedRequest(null)
    setPendingAction(null)
    setComment('')
  }

  function openScopeFilterModal() {
    setDraftCollegeFilter(collegeFilter)
    setDraftDepartmentFilter(departmentFilter)
    setIsScopeFilterModalOpen(true)
  }

  function applyScopeFilters() {
    setCollegeFilter(draftCollegeFilter)
    setDepartmentFilter(draftDepartmentFilter)
    setIsScopeFilterModalOpen(false)
  }

  async function submitReviewDecision() {
    if (!selectedRequest || !pendingAction) return

    setSubmitting(true)
    setError(null)
    setFeedback(null)

    const payload: ScheduleChangeRequestReviewPayload | undefined = comment.trim()
      ? { comment: comment.trim() }
      : undefined

    try {
      const result = pendingAction === 'approve'
        ? await adminScheduleChangeRequestsApi.approve(selectedRequest.id, payload)
        : await adminScheduleChangeRequestsApi.reject(selectedRequest.id, payload)

      setSelectedRequest(result.data)
      setPendingAction(null)
      setComment('')
      setFeedback(
        result.message
        || (pendingAction === 'approve'
          ? 'Schedule change request approved successfully.'
          : 'Schedule change request rejected successfully.'),
      )

      await loadRequests()
    } catch (reviewError: unknown) {
      setError(getErrorMessage(reviewError, 'Failed to submit your review decision.'))
    } finally {
      setSubmitting(false)
    }
  }

  const columns: Column<ScheduleChangeRequest>[] = [
    {
      key: 'requester',
      header: 'Requester',
      render: (request) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{request.requester?.fullName || 'Unknown requester'}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{request.requester?.email || 'No email'}</div>
        </div>
      ),
    },
    {
      key: 'schedule',
      header: 'Schedule',
      render: (request) => {
        const schedule = request.schedule
        const { from, to } = getRequestSnapshots(request)
        const section = from?.section ?? schedule?.section ?? to?.section ?? request.proposal.section ?? '—'

        return (
          <div>
            <div className="font-medium text-gray-900 dark:text-gray-100">{schedule?.subject.code || 'Unknown Subject'}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Section {section}
            </div>
          </div>
        )
      },
    },
    {
      key: 'change',
      header: 'Proposed Change',
      render: (request) => {
        const { from, to } = getRequestSnapshots(request)

        const currentDayPattern = from?.day_pattern ?? request.schedule?.dayPattern ?? '—'
        const currentStartTime = from?.start_time ?? request.schedule?.startTime
        const currentEndTime = from?.end_time ?? request.schedule?.endTime
        const currentRoom = from?.room?.code ?? request.schedule?.room.code ?? '—'

        const proposedDayPattern = to?.day_pattern ?? request.proposal.dayPattern ?? '—'
        const proposedStartTime = to?.start_time ?? request.proposal.startTime
        const proposedEndTime = to?.end_time ?? request.proposal.endTime
        const proposedRoom = to?.room?.code ?? request.proposal.room?.code ?? '—'

        return (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {currentDayPattern} • {formatTimeRange(currentStartTime, currentEndTime)}
            </div>
            <div className="text-xs text-gray-900 dark:text-gray-100 mt-1">
              {proposedDayPattern} • {formatTimeRange(proposedStartTime, proposedEndTime)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Room: {currentRoom} → {proposedRoom}</div>
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (request) => (
        <div className="flex flex-col gap-1">
          <Badge variant={requestStatusVariant(request.status)}>{request.status}</Badge>
          <Badge variant={approvalStatusVariant(request.adminStatus)}>Admin: {request.adminStatus}</Badge>
          <Badge variant={approvalStatusVariant(request.departmentHeadStatus)}>DH: {request.departmentHeadStatus}</Badge>
        </div>
      ),
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      render: (request) => (
        <span className="text-xs text-gray-600 dark:text-gray-300">{formatDateTime(request.submittedAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (request) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              openDetails(request)
            }}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="View details"
          >
            <Eye className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </button>

          {canReview(request) && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  openDecision(request, 'approve')
                }}
                className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30"
                title="Approve"
              >
                <Check className="h-4 w-4 text-green-600" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  openDecision(request, 'reject')
                }}
                className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                title="Reject"
              >
                <XCircle className="h-4 w-4 text-red-600" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Schedule Change Requests</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Review and decide schedule change requests submitted by faculty.</p>
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {feedback && (
        <Alert variant="success" onDismiss={() => setFeedback(null)}>
          {feedback}
        </Alert>
      )}

      <Card>
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="w-full lg:w-80">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search requester, subject, section..."
              className="w-full"
            />
          </div>

          <div className="w-full lg:w-56">
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusOption['value'])}
              options={requestStatusOptions}
            />
          </div>

          <div className="w-full lg:w-64">
            <Select
              value={reviewFilter}
              onChange={(event) => setReviewFilter(event.target.value as ApprovalStatusOption['value'])}
              options={reviewStatusOptions}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            icon={<SlidersHorizontal className="h-4 w-4" />}
            onClick={openScopeFilterModal}
            className="w-full lg:w-auto"
          >
            {activeScopeFilterCount > 0 ? `Filters (${activeScopeFilterCount})` : 'Filters'}
          </Button>

          <Button
            variant="secondary"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() => void loadRequests()}
            loading={loading}
            className="lg:ml-auto"
          >
            Refresh
          </Button>
        </div>
      </Card>

      <Modal
        open={isScopeFilterModalOpen}
        onClose={() => setIsScopeFilterModalOpen(false)}
        title="Filter Requests"
        description="Narrow schedule-change requests by college and department."
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDraftCollegeFilter('all')
                setDraftDepartmentFilter('all')
              }}
            >
              Reset
            </Button>
            <Button type="button" variant="secondary" onClick={() => setIsScopeFilterModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={applyScopeFilters}>
              Apply Filters
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3">
          <div className="w-full">
            <Select
              value={draftCollegeFilter}
              onChange={(event) => setDraftCollegeFilter(event.target.value)}
              options={collegeOptions}
            />
          </div>

          <div className="w-full">
            <Select
              value={draftDepartmentFilter}
              onChange={(event) => setDraftDepartmentFilter(event.target.value)}
              options={draftDepartmentOptions}
            />
          </div>
        </div>
      </Modal>

      <Card>
        <DataTable
          columns={columns}
          data={pagedItems}
          keyExtractor={(request) => request.id}
          loading={loading}
          emptyTitle="No schedule change requests"
          emptyDescription="Try changing filters or wait for new requests."
        />

        <Pagination
          className="mt-4"
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredItems.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </Card>

      <Modal
        open={selectedRequest !== null}
        onClose={closeModal}
        title={selectedRequest ? `Request #${selectedRequest.id}` : 'Request Details'}
        size="xl"
        footer={
          selectedRequest ? (
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={requestStatusVariant(selectedRequest.status)}>{selectedRequest.status}</Badge>
                <Badge variant={approvalStatusVariant(selectedRequest.adminStatus)}>Admin: {selectedRequest.adminStatus}</Badge>
                <Badge variant={approvalStatusVariant(selectedRequest.departmentHeadStatus)}>DH: {selectedRequest.departmentHeadStatus}</Badge>
              </div>

              <div className="flex items-center gap-2">
                {pendingAction ? (
                  <>
                    <Button variant="secondary" onClick={() => setPendingAction(null)} disabled={submitting}>Cancel</Button>
                    <Button
                      variant={pendingAction === 'approve' ? 'primary' : 'danger'}
                      onClick={() => void submitReviewDecision()}
                      loading={submitting}
                    >
                      {pendingAction === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                    </Button>
                  </>
                ) : (
                  <>
                    {canReview(selectedRequest) && (
                      <>
                        <Button variant="danger" onClick={() => setPendingAction('reject')}>Reject</Button>
                        <Button onClick={() => setPendingAction('approve')}>Approve</Button>
                      </>
                    )}
                    <Button variant="secondary" onClick={closeModal} disabled={submitting}>Close</Button>
                  </>
                )}
              </div>
            </div>
          ) : undefined
        }
      >
        {selectedRequest && (
          (() => {
            const { from, to } = getRequestSnapshots(selectedRequest)
            const currentDayPattern = from?.day_pattern ?? selectedRequest.schedule?.dayPattern ?? '—'
            const currentStartTime = from?.start_time ?? selectedRequest.schedule?.startTime
            const currentEndTime = from?.end_time ?? selectedRequest.schedule?.endTime
            const currentRoom = from?.room?.code ?? selectedRequest.schedule?.room.code ?? '—'

            const proposedDayPattern = to?.day_pattern ?? selectedRequest.proposal.dayPattern ?? '—'
            const proposedStartTime = to?.start_time ?? selectedRequest.proposal.startTime
            const proposedEndTime = to?.end_time ?? selectedRequest.proposal.endTime
            const proposedRoom = to?.room?.code ?? selectedRequest.proposal.room?.code ?? '—'

            return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Requester</h3>
                <p className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">{selectedRequest.requester?.fullName || 'Unknown requester'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{selectedRequest.requester?.email || 'No email provided'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Department: {selectedRequest.subjectDepartment?.name || '—'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Submitted: {formatDateTime(selectedRequest.submittedAt)}</p>
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Class</h3>
                <p className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {selectedRequest.schedule?.subject.code || 'Unknown Subject'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{selectedRequest.schedule?.subject.title || 'No title available'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Section: {selectedRequest.schedule?.section || selectedRequest.proposal.section || '—'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Submitted Schedule</h3>
                <p className="mt-2 text-sm text-gray-900 dark:text-gray-100">
                  {currentDayPattern} • {formatTimeRange(currentStartTime, currentEndTime)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Room: {currentRoom}</p>
              </div>

              <div className="rounded-lg border border-blue-200 dark:border-blue-800 p-4 bg-blue-50/40 dark:bg-blue-900/10">
                <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Proposed Schedule</h3>
                <p className="mt-2 text-sm text-gray-900 dark:text-gray-100">
                  {proposedDayPattern} • {formatTimeRange(proposedStartTime, proposedEndTime)}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Room: {proposedRoom}</p>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Reason</h3>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {selectedRequest.requestReason || 'No reason provided.'}
              </p>
            </div>

            {(selectedRequest.adminComment || selectedRequest.departmentHeadComment) && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Admin Comment</h4>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedRequest.adminComment || '—'}</p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Department Head Comment</h4>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedRequest.departmentHeadComment || '—'}</p>
                </div>
              </div>
            )}

            {requestedChangesText && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Requested Changes Snapshot</h3>
                <pre className="mt-2 max-h-56 overflow-auto rounded bg-gray-100 dark:bg-gray-900 p-3 text-xs text-gray-700 dark:text-gray-300">
                  {requestedChangesText}
                </pre>
              </div>
            )}

            {pendingAction && (
              <Textarea
                label={pendingAction === 'approve' ? 'Approval comment (optional)' : 'Rejection comment (optional)'}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder={pendingAction === 'approve' ? 'Add notes for this approval...' : 'Add reason for rejection...'}
                maxLength={2000}
                helperText={`${comment.length}/2000`}
              />
            )}
          </div>
            )
          })()
        )}
      </Modal>
    </div>
  )
}
