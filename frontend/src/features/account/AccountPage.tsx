import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api, ApiError, setToken } from '../../api/client'
import type { LoginResponse } from '../../api/types'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Field, Input } from '../../components/Fields'
import { PageHeader } from '../../components/PageHeader'
import { formatDay, roleLabel } from '../../lib/format'
import { useOnce } from '../../lib/once'
import { toast } from '../../lib/toast'
import { useAuth } from '../auth/AuthContext'

const empty = { current: '', next: '', confirm: '' }

export function AccountPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const once = useOnce()
  const [form, setForm] = useState(empty)
  const [mismatch, setMismatch] = useState(false)
  const set = (key: keyof typeof empty) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value })

  const change = useMutation({
    mutationFn: () =>
      api<LoginResponse>('/auth/password', {
        method: 'POST',
        body: JSON.stringify({ current_password: form.current, new_password: form.next }),
      }),
    onSuccess: (res) => {
      setToken(res.access_token)
      queryClient.setQueryData(['me'], res.user)
      setForm(empty)
      toast('Password changed')
    },
  })

  if (!user) return null
  const fields = change.error instanceof ApiError ? change.error.fields ?? {} : {}
  const top = change.error && !Object.keys(fields).length ? change.error.message : ''

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const differ = form.next !== form.confirm
    setMismatch(differ)
    if (!differ) once(() => change.mutate())
  }

  const details: [string, string][] = [
    ['Full name', user.full_name],
    ['Email', user.email],
    ['Job title', user.job_title],
    ['Role', roleLabel(user.role)],
    ['Department', user.department.name],
    ['Country', user.country.name],
    ['Manager', user.manager?.full_name ?? 'None'],
    ['Joined', formatDay(user.joining_date)],
  ]

  return (
    <div>
      <PageHeader eyebrow="Account" title="Your account" />
      <div className="grid gap-10 md:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-serif text-2xl font-normal">Profile</h2>
          <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-2.5 text-sm">
            {details.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[13px] text-muted">To change these details, ask an HR Admin.</p>
        </Card>
        <Card>
          <h2 className="mb-4 font-serif text-2xl font-normal">Change password</h2>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {top && (
              <p role="alert" className="text-[13px] font-medium text-danger">
                {top}
              </p>
            )}
            <Field label="Current password" error={fields.current_password}>
              <Input type="password" required autoComplete="current-password" value={form.current} onChange={set('current')} />
            </Field>
            <Field
              label="New password"
              hint="At least 8 characters, with a letter and a number. No space at the start or end."
              error={fields.new_password}
            >
              <Input type="password" required autoComplete="new-password" value={form.next} onChange={set('next')} />
            </Field>
            <Field label="Confirm new password" error={mismatch ? 'The two new passwords do not match' : undefined}>
              <Input type="password" required autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
            </Field>
            <Button type="submit" loading={change.isPending} className="self-start">
              Change password
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
