'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil, CheckCircle, BookOpen } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { curriculaApi } from '@/lib/admin-api'
import { formatDate } from '@/lib/utils'
import type { Curriculum } from '@/types'

export default function CurriculumViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    curriculaApi.get(Number(id))
      .then(setCurriculum)
      .catch(() => setError('Failed to load curriculum.'))
      .finally(() => setLoading(false))
  }, [id])

  async function publish() {
    if (!curriculum) return
    try { await curriculaApi.publish(curriculum.id); setCurriculum({ ...curriculum, isPublished: true }) } catch { setError('Failed to publish.') }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (error || !curriculum) return <Alert variant="error">{error || 'Not found.'}</Alert>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={curriculum.department?.id ? `/admin/curricula/department/${curriculum.department.id}` : '/admin/curricula'} className="p-2 rounded hover:bg-gray-100"><ArrowLeft className="h-5 w-5 text-gray-500" /></Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{curriculum.name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Version {curriculum.version} &mdash; <Badge variant={curriculum.isPublished ? 'success' : 'warning'}>{curriculum.isPublished ? 'Published' : 'Draft'}</Badge>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/curricula/${id}/subjects`}><Button variant="secondary" size="sm"><BookOpen className="h-4 w-4 mr-1" />Manage Subjects</Button></Link>
          {!curriculum.isPublished && <Button variant="secondary" size="sm" onClick={publish}><CheckCircle className="h-4 w-4 mr-1" />Publish</Button>}
          <Link href={`/admin/curricula/${id}/edit`}><Button size="sm"><Pencil className="h-4 w-4 mr-1" />Edit</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader title="Details" />
          <dl className="space-y-3 text-sm">
            <div><dt className="text-gray-500">Department</dt><dd className="font-medium">{curriculum.department?.name || '—'}</dd></div>
            <div><dt className="text-gray-500">Notes</dt><dd className="font-medium">{curriculum.notes || '—'}</dd></div>
            <div><dt className="text-gray-500">Created</dt><dd className="font-medium">{curriculum.createdAt ? formatDate(curriculum.createdAt) : '—'}</dd></div>
            <div><dt className="text-gray-500">Updated</dt><dd className="font-medium">{curriculum.updatedAt ? formatDate(curriculum.updatedAt) : '—'}</dd></div>
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Curriculum Terms" />
          {curriculum.curriculumTerms?.length ? (
            <div className="space-y-4">
              {curriculum.curriculumTerms.map(term => (
                <div key={term.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">{term.displayName}</h4>
                    <Badge variant="primary">{term.totalUnits} units</Badge>
                  </div>
                  {term.curriculumSubjects?.length ? (
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">Code</th><th className="pb-2">Title</th><th className="pb-2">Units</th><th className="pb-2">Type</th></tr></thead>
                      <tbody>
                        {term.curriculumSubjects.map(cs => (
                          <tr key={cs.id} className="border-b last:border-0">
                            <td className="py-2 font-mono text-xs">{cs.subject.code}</td>
                            <td className="py-2">{cs.subject.title}</td>
                            <td className="py-2">{cs.subject.units}</td>
                            <td className="py-2"><Badge variant={cs.subject.type === 'laboratory' ? 'warning' : 'default'}>{cs.subject.type}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-gray-400 flex items-center gap-1"><BookOpen className="h-4 w-4" />No subjects assigned to this term.</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No terms defined yet.</p>
          )}
        </Card>
      </div>
    </div>
  )
}
