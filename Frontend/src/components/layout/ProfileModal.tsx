'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { ROLE_LABELS } from '@/lib/constants'
import { Mail, Phone, MapPin, Briefcase, Building2, Hash } from 'lucide-react'
import Link from 'next/link'

interface ProfileModalProps {
  open: boolean
  onClose: () => void
}

export function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { user } = useAuth()

  if (!user) return null

  const fullName = `${user.firstName} ${user.middleName ? user.middleName + ' ' : ''}${user.lastName}`
  const roleLabel = ROLE_LABELS[user.role] ?? 'User'

  const roleBadgeVariant = user.role === 1 ? 'purple' as const
    : user.role === 2 ? 'primary' as const
    : 'success' as const

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="flex flex-col items-center pb-4">
        <Avatar name={fullName} size="xl" />
        <h2 className="mt-4 text-xl font-bold text-gray-900">{fullName}</h2>
        <Badge variant={roleBadgeVariant} className="mt-2">{roleLabel}</Badge>
      </div>

      <div className="space-y-3 border-t border-gray-100 pt-4">
        {user.email && (
          <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={user.email} />
        )}
        {user.employeeId && (
          <InfoRow icon={<Hash className="h-4 w-4" />} label="Employee ID" value={user.employeeId} />
        )}
        {user.position && (
          <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Position" value={user.position} />
        )}
        {user.department && (
          <InfoRow icon={<Building2 className="h-4 w-4" />} label="Department" value={user.department.name} />
        )}
        {user.address && (
          <InfoRow icon={<MapPin className="h-4 w-4" />} label="Address" value={user.address} />
        )}
      </div>

      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
        <Link
          href="/profile/edit"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Edit Profile
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Close
        </button>
      </div>
    </Modal>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-400">{icon}</span>
      <span className="text-gray-500 w-28">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  )
}

export type { ProfileModalProps }
