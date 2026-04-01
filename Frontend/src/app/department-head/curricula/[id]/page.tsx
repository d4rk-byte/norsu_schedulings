'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, BookOpen, ChevronDown } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { ConfirmModal } from '@/components/ui/Modal'
import { dhCurriculaApi } from '@/lib/department-head-api'
import type { Curriculum } from '@/types'

export default function DHCurriculumViewPage() {
  const { id } = useParams<{ id: string }>()
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showToggle, setShowToggle] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [expandedTerms, setExpandedTerms] = useState<Record<number, boolean>>({})

  useEffect(() => {
    dhCurriculaApi.get(Number(id))
      .then(setCurriculum)
      .catch(() => setError('Failed to load curriculum'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleTogglePublish() {
    if (!curriculum) return
    setToggling(true)
    try {
      const fn = curriculum.isPublished ? dhCurriculaApi.unpublish : dhCurriculaApi.publish
      await fn(curriculum.id)
      setCurriculum(prev => prev ? { ...prev, isPublished: !prev.isPublished } : prev)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      setError(msg || 'Failed to update curriculum status')
    }
    setToggling(false)
    setShowToggle(false)
  }

  function toggleTerm(termId: number) {
    setExpandedTerms((prev) => {
      const currentlyExpanded = prev[termId] ?? true
      return { ...prev, [termId]: !currentlyExpanded }
    })
  }

  function jumpToTerm(termId: number) {
    const el = document.getElementById(`term-${termId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
  if (error || !curriculum) return <Alert variant="error">{error || 'Curriculum not found'}</Alert>

  const sortedTerms = [...(curriculum.curriculumTerms ?? [])].sort((a, b) => a.yearLevel - b.yearLevel || a.semester.localeCompare(b.semester))
  const totalSubjects = sortedTerms.reduce((sum, t) => sum + t.curriculumSubjects.length, 0)
  const totalUnits = sortedTerms.reduce((sum, t) => sum + t.totalUnits, 0)

  return (
    <div className="space-y-6">
      {error && <Alert variant="error" onDismiss={() => setError('')}>{error}</Alert>}

      <div className="flex items-center gap-4">
        <Link href="/department-head/curricula" className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft className="h-5 w-5 text-gray-500" /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{curriculum.name}</h1>
          <p className="mt-1 text-sm text-gray-500">Version {curriculum.version ? `v${curriculum.version}` : '—'} • {curriculum.department.name}</p>
        </div>
      </div>

      <div className="sticky top-16 z-20 bg-gray-50/95 backdrop-blur supports-backdrop-filter:bg-gray-50/80 border border-gray-200 rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={curriculum.isPublished ? 'success' : 'warning'}>{curriculum.isPublished ? 'Published' : 'Draft'}</Badge>
          <Button size="sm" variant={curriculum.isPublished ? 'danger' : 'primary'} onClick={() => setShowToggle(true)}>
            {curriculum.isPublished ? 'Unpublish' : 'Publish'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg"><BookOpen className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Total Subjects</p>
              <p className="text-xl font-bold text-gray-900">{totalSubjects}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg"><BookOpen className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Total Units</p>
              <p className="text-xl font-bold text-gray-900">{totalUnits}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg"><BookOpen className="h-5 w-5 text-purple-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <Badge variant={curriculum.isPublished ? 'success' : 'warning'}>{curriculum.isPublished ? 'Published' : 'Draft'}</Badge>
            </div>
          </div>
        </Card>
      </div>

      {curriculum.notes && (
        <Card>
          <CardHeader title="Notes" />
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{curriculum.notes}</p>
        </Card>
      )}

      {sortedTerms.length === 0 ? (
        <Card><p className="text-center text-gray-400 py-8">No terms defined yet.</p></Card>
      ) : (
        sortedTerms.map(term => {
          const isExpanded = expandedTerms[term.id] ?? true

          return (
            <Card key={term.id} id={`term-${term.id}`}>
              <button className="w-full" onClick={() => toggleTerm(term.id)}>
                <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-gray-100">
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">{term.displayName || `Year ${term.yearLevel} – ${term.semester}`}</h3>
                    <p className="mt-1 text-sm text-gray-500">{term.curriculumSubjects.length} subjects • {term.totalUnits} units</p>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isExpanded && (
                <div className="p-6 pt-4">
                  {term.curriculumSubjects.length === 0 ? (
                    <p className="text-sm text-gray-400">No subjects in this term.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-gray-500">
                            <th className="py-2 pr-4 font-medium">Code</th>
                            <th className="py-2 pr-4 font-medium">Title</th>
                            <th className="py-2 pr-4 font-medium text-center">Units</th>
                            <th className="py-2 pr-4 font-medium text-center">Lec Hrs</th>
                            <th className="py-2 pr-4 font-medium text-center">Lab Hrs</th>
                            <th className="py-2 font-medium">Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {term.curriculumSubjects.map(cs => (
                            <tr key={cs.id} className="border-b last:border-0">
                              <td className="py-2 pr-4 font-medium text-gray-900">{cs.subject.code}</td>
                              <td className="py-2 pr-4 text-gray-700">{cs.subject.title}</td>
                              <td className="py-2 pr-4 text-center">{cs.subject.units}</td>
                              <td className="py-2 pr-4 text-center">{cs.subject.lectureHours}</td>
                              <td className="py-2 pr-4 text-center">{cs.subject.labHours}</td>
                              <td className="py-2"><Badge variant="default">{cs.subject.type}</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })
      )}

      <ConfirmModal open={showToggle} onClose={() => setShowToggle(false)} onConfirm={handleTogglePublish} loading={toggling} title={curriculum.isPublished ? 'Unpublish Curriculum' : 'Publish Curriculum'} message={`Are you sure you want to ${curriculum.isPublished ? 'unpublish' : 'publish'} "${curriculum.name}"?`} variant={curriculum.isPublished ? 'danger' : 'primary'} confirmLabel={curriculum.isPublished ? 'Unpublish' : 'Publish'} />
    </div>
  )
}
