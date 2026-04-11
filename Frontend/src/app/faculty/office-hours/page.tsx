'use client'

import {
  Clock,
  Calendar,
  Users,
  Info,
} from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/contexts/AuthContext'

const SAMPLE_HOURS = [
  { day: 'Monday', time: '3:00 PM — 5:00 PM', type: 'Walk-in' },
  { day: 'Wednesday', time: '3:00 PM — 5:00 PM', type: 'Walk-in' },
  { day: 'Friday', time: '1:00 PM — 3:00 PM', type: 'By Appointment' },
]

export default function FacultyOfficeHoursPage() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Office Hours</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your consultation schedule and availability.</p>
      </div>

      <Alert variant="info">
        Office hours management is a preview feature. Full functionality including student booking and consultation tracking will be available in a future update.
      </Alert>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Weekly Hours', value: '10', icon: Clock, bg: 'bg-blue-50', color: 'text-blue-600' },
          { label: 'Consultations This Week', value: '—', icon: Users, bg: 'bg-green-50', color: 'text-green-600' },
          { label: 'Availability', value: '—', icon: Calendar, bg: 'bg-amber-50', color: 'text-amber-600' },
        ].map((s) => (
          <Card key={s.label}>
            <div className="flex items-center gap-3">
              <div className={`${s.bg} p-2.5 rounded-lg`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly schedule */}
        <Card>
          <CardHeader title="Weekly Office Hours" description="Your regular consultation schedule" />
          <div className="space-y-3">
            {SAMPLE_HOURS.map((h, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50">
                <div className="shrink-0 w-24">
                  <p className="text-sm font-semibold text-gray-900">{h.day}</p>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-700">{h.time}</p>
                </div>
                <Badge variant={h.type === 'Walk-in' ? 'success' : 'primary'}>
                  {h.type}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Info card */}
        <Card>
          <CardHeader title="About Office Hours" />
          <div className="space-y-4 text-sm text-gray-600">
            <p>
              Office hours provide dedicated time for student consultations, academic advising, and mentoring.
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <span>Students can visit during walk-in hours without an appointment.</span>
              </div>
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <span>Appointment-based hours require students to schedule in advance.</span>
              </div>
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <span>You can update your availability once the feature is fully integrated.</span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Location: {user?.department?.name ?? 'Department'} Faculty Room
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
