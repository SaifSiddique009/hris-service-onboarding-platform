import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../api/client'
import type { User, UserSummary, UserUpdated, UserWrite } from '../../api/types'
import { Button } from '../../components/Button'
import { Field, Input, Select } from '../../components/Fields'
import { FormDialog } from '../../components/FormDialog'
import { employmentStatuses, errorText, label, roleLabel, roles } from '../../lib/format'
import { PersonPicker } from '../onboarding/PersonPicker'
import { useCountries, useDepartments } from '../requests/queries'

interface Props {
  user?: User
  onClose: () => void
  onSaved: (saved: UserUpdated) => void
}

export function UserDialog({ user, onClose, onSaved }: Props) {
  const queryClient = useQueryClient()
  const departments = useDepartments()
  const countries = useCountries(true)
  const [form, setForm] = useState(() => ({
    full_name: '',
    email: '',
    password: '',
    joining_date: new Date().toLocaleDateString('en-CA'),
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
        role: form.role,
        country: form.country,
        department_id: Number(form.department_id),
        manager_id: manager?.id ?? null,
        status: form.status,
      }
      if (user) return api<UserUpdated>(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ ...shared, is_active: form.is_active }) })
      const body: UserWrite = {
        ...shared,
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        joining_date: form.joining_date,
      }
      return api<UserUpdated>('/users', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['people'] })
      onSaved(saved)
    },
  })

  return (
    <FormDialog
      title={user ? `Edit ${user.full_name}` : 'Add employee'}
      submitLabel={user ? 'Save' : 'Add employee'}
      onClose={onClose}
      pending={save.isPending}
      error={save.error ? errorText(save.error) : undefined}
      onSubmit={save.mutate}
    >
      {!user && (
        <>
          <Field label="Full name">
            <Input required minLength={2} maxLength={120} value={form.full_name} onChange={set('full_name')} />
          </Field>
          <Field label="Email">
            <Input type="email" required maxLength={200} value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Temporary password" hint="At least 8 characters.">
            <Input type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={set('password')} />
          </Field>
          <Field label="Joining date">
            <Input type="date" required value={form.joining_date} onChange={set('joining_date')} />
          </Field>
        </>
      )}
      <Field label="Job title">
        <Input required minLength={2} maxLength={120} value={form.job_title} onChange={set('job_title')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role">
          <Select value={form.role} onChange={set('role')}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Employment status">
          <Select value={form.status} onChange={set('status')}>
            {employmentStatuses.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Department">
          <Select required value={form.department_id} onChange={set('department_id')}>
            <option value="">Select</option>
            {departments.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Country">
          <Select required value={form.country} onChange={set('country')}>
            <option value="">Select</option>
            {countries.data?.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">Manager: {manager ? manager.full_name : 'None'}</p>
        {manager && (
          <Button type="button" variant="secondary" onClick={() => setManager(null)}>
            Remove manager
          </Button>
        )}
        <PersonPicker
          scope={['lookup']}
          fetchPeople={(search) => api<UserSummary[]>(`/users/lookup?search=${encodeURIComponent(search)}`)}
          selectedId={manager?.id}
          onPick={setManager}
          detail={(p) => `${roleLabel(p.role)} · ${p.job_title}`}
        />
      </div>

      {user && (
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="size-4 accent-indigo-600"
          />
          Account active
        </label>
      )}
    </FormDialog>
  )
}
