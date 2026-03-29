'use client'

import { useState, useEffect, FormEvent } from 'react'
import { Save } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { settingsApi } from '@/lib/admin-api'

type SettingsState = Record<string, unknown>

function isSettingsState(value: unknown): value is SettingsState {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingAutoActivate, setSavingAutoActivate] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    settingsApi.get()
      .then(data => setSettings(isSettingsState(data) ? data : {}))
      .catch(() => setError('Failed to load settings.'))
      .finally(() => setLoading(false))
  }, [])

  const set = (key: string, value: unknown) => setSettings(prev => ({ ...prev, [key]: value }))
  const getString = (key: string, fallback = '') => typeof settings[key] === 'string' ? String(settings[key]) : fallback

  const autoActivateRaw = settings.auto_activate_new_users
  const autoActivateNewUsers =
    typeof autoActivateRaw === 'boolean'
      ? autoActivateRaw
      : autoActivateRaw === 1 || autoActivateRaw === '1' || autoActivateRaw === 'true'

  async function handleAutoActivateToggleChange(enabled: boolean) {
    const previous = autoActivateNewUsers

    set('auto_activate_new_users', enabled)
    setSavingAutoActivate(true)
    setError('')
    setSuccess('')

    try {
      const updated = await settingsApi.update({ auto_activate_new_users: enabled })
      if (isSettingsState(updated)) {
        setSettings(prev => ({ ...prev, ...updated }))
      }
      setSuccess(`Auto-activation for newly registered users is now ${enabled ? 'ON' : 'OFF'}.`)
    } catch (err: unknown) {
      set('auto_activate_new_users', previous)
      setError(err instanceof Error ? err.message : 'Failed to update auto-activation setting.')
    } finally {
      setSavingAutoActivate(false)
    }
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await settingsApi.update(settings)
      setSuccess('Settings saved successfully.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">System Settings</h1><p className="mt-1 text-sm text-gray-500">Configure system-wide settings.</p></div>
      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader title="User Registration" />
          <div className="max-w-xl rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Auto-activate newly registered faculty</p>
                <p className="mt-1 text-sm text-gray-500">
                  Turn this on if you want users who sign up to become active immediately. Turn it off to require manual admin approval first.
                </p>
              </div>
              <label className="relative inline-flex h-6 w-11 cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={autoActivateNewUsers}
                  onChange={e => handleAutoActivateToggleChange(e.target.checked)}
                  disabled={savingAutoActivate}
                />
                <span className="h-6 w-11 rounded-full bg-gray-300 transition-colors peer-checked:bg-emerald-500" />
                <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
              </label>
            </div>
            {savingAutoActivate && (
              <p className="mt-2 text-xs text-gray-500">Saving auto-activation setting...</p>
            )}
            <p className={`mt-3 text-xs font-medium ${autoActivateNewUsers ? 'text-emerald-700' : 'text-amber-700'}`}>
              {autoActivateNewUsers
                ? 'Newly registered users are activated immediately and can log in right away.'
                : 'Newly registered users stay inactive until an admin manually activates their account.'}
            </p>
          </div>
        </Card>
        <Card>
          <CardHeader title="General" />
          <div className="space-y-4 max-w-xl">
            <Input label="Institution Name" value={getString('institution_name')} onChange={e => set('institution_name', e.target.value)} />
            <Input label="Institution Abbreviation" value={getString('institution_abbreviation')} onChange={e => set('institution_abbreviation', e.target.value)} />
            <Input label="Contact Email" type="email" value={getString('contact_email')} onChange={e => set('contact_email', e.target.value)} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Scheduling" />
          <div className="space-y-4 max-w-xl">
            <Input label="Max Teaching Hours/Week" type="number" value={getString('max_teaching_hours', '24')} onChange={e => set('max_teaching_hours', e.target.value)} />
            <Input label="Max Units/Faculty" type="number" value={getString('max_units_per_faculty', '27')} onChange={e => set('max_units_per_faculty', e.target.value)} />
            <Input label="Default Start Time" type="time" value={getString('default_start_time', '07:00')} onChange={e => set('default_start_time', e.target.value)} />
            <Input label="Default End Time" type="time" value={getString('default_end_time', '21:00')} onChange={e => set('default_end_time', e.target.value)} />
          </div>
        </Card>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save Settings'}</Button>
        </div>
      </form>
    </div>
  )
}
