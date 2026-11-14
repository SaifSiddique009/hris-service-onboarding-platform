import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../../api/client'
import type { EmploymentStatus, Role, User, UserSummary, UserUpdated, UserWrite } from '../../api/types'
import { Button } from '../../components/Button'
import { ChipGroup } from '../../components/ChipGroup'
import { Field, Input } from '../../components/Fields'
import { FormDialog } from '../../components/FormDialog'
import { employmentStatuses, label, roleLabel, roles } from '../../lib/format'
import { useOnce } from '../../lib/once'
import { toast } from '../../lib/toast'
import { useAuth } from '../auth/AuthContext'
import { PersonPicker } from '../onboarding/PersonPicker'
import { useCountries, useDepartments } from '../requests/queries'

interface Props {
  user?: User
  onClose: () => void
  onSaved: (saved: UserUpdated) => void
}

function Choice({ label, help, disabled, ...rest }: ComponentProps<typeof ChipGroup> & { help?: string; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[13px] font-semibold">{label}</p>
      <fieldset disabled={disabled} aria-disabled={disabled} className="min-w-0 border-0 p-0 disabled:opacity-50">
        <ChipGroup label={label} {...rest} />
      </fieldset>
      {help && <p className="text-[13px] text-muted">{help}</p>}
    </div>
  )
}

export function UserDialog({ user, onClose, onSaved }: Props) {
  const queryClient = useQueryClient()
  const { user: me } = useAuth()
  const once = useOnce()
  const isSelf = !!user && user.id === me?.id
  const [newPassword, setNewPassword] = useState('')
  const departments = useDepartments()
  const countries = useCountries(true)
  const [form, setForm] = useState(() => ({
    full_name: user?.full_name ?? '',
    email: '',
    password: '',
    joining_date: user?.joining_date ?? new Date().toLocaleDateString('en-CA'),
    job_title: user?.job_title ?? '',
    role: user?.role ?? 'EMPLOYEE',
    country: user?.country.code ?? '',
    department_id: user ? String(user.department.id) : '',
    status: user?.status ?? 'ACTIVE',
    is_active: user?.is_active ?? true,
  }))
  const [manager, setManager] = useState<UserSummary | null>(user?.manager ?? null)
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value })

  const save = useMutation({
    mutationFn: () => {
      const shared = {
        job_title: form.job_title.trim(),
        country: form.country,
        department_id: Number(form.department_id),
        manager_id: manager?.id ?? null,
        status: form.status,
      }
      const person = { ...shared, full_name: form.full_name.trim(), joining_date: form.joining_date }
      if (user) {
        const access = isSelf ? {} : { role: form.role, is_active: form.is_active }
        return api<UserUpdated>(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ ...person, ...access }) })
      }
      const body: UserWrite = { ...person, role: form.role, email: form.email.trim(), password: form.password }
      return api<UserUpdated>('/users', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['people'] })
      toast(user ? 'Changes saved' : 'Employee added')
      onSaved(saved)
    },
  })

  const reset = useMutation({
    mutationFn: () => api<void>(`/users/${user?.id}/password`, { method: 'POST', body: JSON.stringify({ new_password: newPassword }) }),
    onSuccess: () => {
      setNewPassword('')
      toast(`New password set for ${user?.full_name}`)
    },
  })
  const resetFields = reset.error instanceof ApiError ? reset.error.fields ?? {} : {}
  const resetTop = reset.error && !Object.keys(resetFields).length ? reset.error.message : ''
  const setPassword = () => once(() => reset.mutate())

  const fields = save.error instanceof ApiError ? save.error.fields ?? {} : {}
  const shown = ['full_name', 'joining_date', 'job_title', ...(user ? [] : ['email', 'password'])]
  const other = Object.entries(fields).filter(([k]) => !shown.includes(k)).map(([, m]) => m)
  const top = other.length ? other.join('. ') : save.error && !Object.keys(fields).length ? save.error.message : ''
  const topRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (top) topRef.current?.scrollIntoView({ block: 'nearest' })
  }, [top])

  return (
    <FormDialog
      eyebrow="People"
      title={user ? `Edit ${user.full_name}` : 'Add employee'}
      submitLabel={user ? 'Save' : 'Add employee'}
      onClose={onClose}
      pending={save.isPending}
      disabled={!form.country || !form.department_id}
      onSubmit={save.mutate}
    >
      {top && (
        <p ref={topRef} role="alert" className="text-[13px] font-medium text-danger">
          {top}
        </p>
      )}
      <Field label="Full name" error={fields.full_name}>
        <Input required minLength={2} maxLength={120} value={form.full_name} onChange={set('full_name')} />
      </Field>
      {!user && (
        <>
          <Field label="Email" error={fields.email}>
            <Input type="email" required maxLength={200} value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Temporary password" hint="At least 8 characters." error={fields.password}>
            <Input type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={set('password')} />
          </Field>
        </>
      )}
      <Field label="Joining date" error={fields.joining_date}>
        <Input type="date" required value={form.joining_date} onChange={set('joining_date')} />
      </Field>
      <Field label="Job title" error={fields.job_title}>
        <Input required minLength={2} maxLength={120} value={form.job_title} onChange={set('job_title')} />
      </Field>
      <Choice disabled={isSelf} label="Role" value={form.role} options={roles.map((r) => ({ value: r, label: roleLabel(r) }))} onChange={(v) => setForm({ ...form, role: v as Role })} />
      <Choice
        label="Employment status"
        value={form.status}
        options={employmentStatuses.map((s) => ({ value: s, label: label(s) }))}
        onChange={(v) => setForm({ ...form, status: v as EmploymentStatus })}
      />
      <Choice
        label="Country"
        value={form.country}
        options={(countries.data ?? []).map((c) => ({ value: c.code, label: c.name }))}
        onChange={(v) => setForm({ ...form, country: v })}
      />
      <Choice
        label="Department"
        value={form.department_id}
        options={(departments.data ?? []).map((d) => ({ value: String(d.id), label: d.name }))}
        onChange={(v) => setForm({ ...form, department_id: v })}
      />

      <div className="flex flex-col gap-1.5">
        <p className="text-[13px] font-semibold">Manager: {manager ? manager.full_name : 'None'}</p>
        {manager && (
          <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => setManager(null)}>
            Remove manager
          </Button>
        )}
        <PersonPicker
          scope={['lookup', 'managing', user?.id]}
          fetchPeople={(search) =>
            api<UserSummary[]>(`/users/lookup?managing=true&search=${encodeURIComponent(search)}`).then((people) =>
              people.filter((p) => p.id !== user?.id),
            )
          }
          selectedId={manager?.id}
          onPick={setManager}
          detail={(p) => `${roleLabel(p.role)} · ${p.job_title}`}
        />
      </div>

      {user && (
        <Choice
          label="Sign-in"
          value={form.is_active ? 'yes' : 'no'}
          options={[
            { value: 'yes', label: 'Enabled' },
            { value: 'no', label: 'Disabled' },
          ]}
          onChange={(v) => setForm({ ...form, is_active: v === 'yes' })}
          disabled={isSelf}
          help={isSelf ? 'You cannot change your own role or sign-in.' : 'A disabled account cannot sign in.'}
          segmented
        />
      )}

      {user && (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <p className="text-[13px] font-semibold">Password</p>
          {isSelf ? (
            <p className="text-[13px] text-muted">
              <Link to="/account">Change your own password on the Account page.</Link>
            </p>
          ) : (
            <>
              <Field label="New password" error={resetFields.new_password}>
                <Input
                  autoComplete="off"
                  maxLength={72}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value)
                    if (reset.isSuccess) reset.reset()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      setPassword()
                    }
                  }}
                />
              </Field>
              {resetTop && (
                <p role="alert" className="text-[13px] font-medium text-danger">
                  {resetTop}
                </p>
              )}
              <Button type="button" variant="secondary" size="sm" className="self-start" loading={reset.isPending} disabled={!newPassword} onClick={setPassword}>
                Set new password
              </Button>
              {reset.isSuccess && <p className="text-[13px] text-muted">They are signed out everywhere. Give them the new password privately.</p>}
            </>
          )}
        </div>
      )}
    </FormDialog>
  )
}
