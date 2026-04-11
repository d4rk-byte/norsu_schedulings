'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { facultyApi, type FacultyCompletionOptions } from '@/lib/faculty-api'
import { POSITION_OPTIONS } from '@/lib/constants'
import { useAuth } from '@/contexts/AuthContext'

type CompletionFormState = {
  first_name: string
  middle_name: string
  last_name: string
  college_id: number
  department_id: number
  position: string
  other_designation: string
  address: string
}

const emptyForm: CompletionFormState = {
  first_name: '',
  middle_name: '',
  last_name: '',
  college_id: 0,
  department_id: 0,
  position: '',
  other_designation: '',
  address: '',
}

function isProfileIncomplete(profile: {
  first_name: string | null
  last_name: string | null
  college: { id: number; name: string } | null
  department: { id: number; name: string } | null
  position: string | null
  profile_complete?: boolean
}): boolean {
  if (typeof profile.profile_complete === 'boolean') {
    return !profile.profile_complete
  }

  return (
    !profile.first_name?.trim()
    || !profile.last_name?.trim()
    || !profile.college
    || !profile.department
    || !profile.position?.trim()
  )
}

export function FacultyProfileCompletionGate() {
  const { isAuthenticated, isFaculty, isLoading } = useAuth()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [errors, setErrors] = useState<Partial<Record<keyof CompletionFormState, string>>>({})
  const [options, setOptions] = useState<FacultyCompletionOptions>({ colleges: [], departments: [] })
  const [form, setForm] = useState<CompletionFormState>(emptyForm)

  const filteredDepartments = useMemo(() => {
    if (!form.college_id) {
      return options.departments
    }
    return options.departments.filter((department) => department.college_id === form.college_id)
  }, [options.departments, form.college_id])

  const canSubmit = useMemo(() => {
    return Boolean(
      form.first_name.trim()
      && form.last_name.trim()
      && form.college_id > 0
      && form.department_id > 0
      && form.position.trim(),
    )
  }, [form])

  const loadProfileCompletionState = useCallback(async () => {
    if (!isAuthenticated || !isFaculty) {
      setOpen(false)
      return
    }

    setLoading(true)
    setLoadError('')
    setSubmitError('')
    setErrors({})

    try {
      const profile = await facultyApi.getProfile()

      if (!isProfileIncomplete(profile)) {
        setOpen(false)
        return
      }

      setForm({
        first_name: profile.first_name ?? '',
        middle_name: profile.middle_name ?? '',
        last_name: profile.last_name ?? '',
        college_id: profile.college?.id ?? 0,
        department_id: profile.department?.id ?? 0,
        position: profile.position ?? '',
        other_designation: profile.other_designation ?? '',
        address: profile.address ?? '',
      })

      try {
        const completionOptions = await facultyApi.getProfileCompletionOptions()
        setOptions(completionOptions)
      } catch {
        const fallbackOptions: FacultyCompletionOptions = {
          colleges: profile.college
            ? [{ id: profile.college.id, code: '', name: profile.college.name }]
            : [],
          departments: profile.department
            ? [{
                id: profile.department.id,
                code: '',
                name: profile.department.name,
                college_id: profile.college?.id ?? null,
              }]
            : [],
        }

        setOptions(fallbackOptions)
        setLoadError('Failed to load required profile completion data. Please retry.')
      }

      setOpen(true)
    } catch {
      // Avoid blocking the UI with the completion modal when profile data
      // itself cannot be loaded due to a transient API/network failure.
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, isFaculty])

  useEffect(() => {
    if (isLoading) {
      return
    }

    void loadProfileCompletionState()
  }, [isLoading, loadProfileCompletionState])

  function setField<K extends keyof CompletionFormState>(field: K, value: CompletionFormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function validateForm() {
    const nextErrors: Partial<Record<keyof CompletionFormState, string>> = {}

    if (!form.first_name.trim()) nextErrors.first_name = 'First name is required.'
    if (!form.last_name.trim()) nextErrors.last_name = 'Last name is required.'
    if (!form.college_id) nextErrors.college_id = 'College is required.'
    if (!form.department_id) nextErrors.department_id = 'Department is required.'
    if (!form.position.trim()) nextErrors.position = 'Position is required.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!validateForm()) return

    setSaving(true)
    setSubmitError('')

    try {
      await facultyApi.completeProfile({
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim() || undefined,
        last_name: form.last_name.trim(),
        college_id: form.college_id,
        department_id: form.department_id,
        position: form.position.trim(),
        other_designation: form.other_designation.trim() || undefined,
        address: form.address.trim() || undefined,
      })

      setOpen(false)
      window.location.reload()
    } catch (error: unknown) {
      const details = (error as { response?: { data?: { error?: { details?: Record<string, string> } } } })?.response?.data?.error?.details
      if (details) {
        setErrors((prev) => ({ ...prev, ...details }))
      }

      const message =
        (error as { response?: { data?: { message?: string; error?: { message?: string } } } })?.response?.data?.message
        || (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
        || 'Failed to complete your profile. Please try again.'

      setSubmitError(message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return null
  }

  return (
    <Modal open={open} onClose={() => {}} closeOnOverlay={false} size="xl">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-stone-900 dark:text-white">Complete Your Profile</h2>
          <p className="mt-1 text-sm text-stone-600 dark:text-gray-300">
            Please complete your required profile details to continue.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <>
            {loadError && <Alert variant="error">{loadError}</Alert>}
            {submitError && <Alert variant="error">{submitError}</Alert>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="First Name"
                  required
                  value={form.first_name}
                  onChange={(e) => setField('first_name', e.target.value)}
                  error={errors.first_name}
                />
                <Input
                  label="Middle Name"
                  value={form.middle_name}
                  onChange={(e) => setField('middle_name', e.target.value)}
                  error={errors.middle_name}
                />
                <Input
                  label="Last Name"
                  required
                  value={form.last_name}
                  onChange={(e) => setField('last_name', e.target.value)}
                  error={errors.last_name}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="College"
                  required
                  value={form.college_id ? String(form.college_id) : ''}
                  onChange={(e) => {
                    const nextCollegeId = e.target.value ? Number(e.target.value) : 0
                    const departmentStillValid = options.departments.some(
                      (department) => department.id === form.department_id && department.college_id === nextCollegeId,
                    )

                    setForm((prev) => ({
                      ...prev,
                      college_id: nextCollegeId,
                      department_id: departmentStillValid ? prev.department_id : 0,
                    }))
                    setErrors((prev) => ({ ...prev, college_id: undefined, department_id: undefined }))
                  }}
                  options={options.colleges.map((college) => ({ value: String(college.id), label: college.name }))}
                  placeholder="-- Select College --"
                  error={errors.college_id}
                />
                <Select
                  label="Department"
                  required
                  value={form.department_id ? String(form.department_id) : ''}
                  onChange={(e) => setField('department_id', e.target.value ? Number(e.target.value) : 0)}
                  options={filteredDepartments.map((department) => ({ value: String(department.id), label: department.name }))}
                  placeholder="-- Select Department --"
                  error={errors.department_id}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Position"
                  required
                  value={form.position}
                  onChange={(e) => setField('position', e.target.value)}
                  options={POSITION_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                  placeholder="-- Select Position --"
                  error={errors.position}
                />
                <Input
                  label="Other Designation"
                  value={form.other_designation}
                  onChange={(e) => setField('other_designation', e.target.value)}
                  error={errors.other_designation}
                />
              </div>

              <Input
                label="Address"
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
                error={errors.address}
              />

              <div className="flex justify-end pt-2">
                <Button type="submit" loading={saving} disabled={!canSubmit || !!loadError}>
                  Save and Continue
                </Button>
              </div>
            </form>

            {loadError && (
              <div className="flex justify-end">
                <Button type="button" variant="secondary" onClick={() => void loadProfileCompletionState()}>
                  Retry Loading
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
