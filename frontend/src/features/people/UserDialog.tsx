import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ComponentProps } from 'react'
import { api } from '../../api/client'
import type { EmploymentStatus, Role, User, UserSummary, UserUpdated, UserWrite } from '../../api/types'
import { Button } from '../../components/Button'
import { ChipGroup } from '../../components/ChipGroup'
import { Field, Input } from '../../components/Fields'
import { FormDialog } from '../../components/FormDialog'
import { employmentStatuses, errorText, label, roleLabel, roles } from '../../lib/format'
import { PersonPicker } from '../onboarding/PersonPicker'
import { useCountries, useDepartments } from '../requests/queries'

interface Props {
  user?: User
  onClose: () => void
  onSaved: (saved: UserUpdated) => void
}

function Choice({ label, help, ...rest }: ComponentProps<typeof ChipGroup> & { help?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[13px] font-semibold">{label}</p>
      <ChipGroup label={label} {...rest} />
      {help && <p className="text-[13px] text-muted">{help}</p>}
    </div>
  )
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
      eyebrow="People"
      title={user ? `Edit ${user.full_name}` : 'Add employee'}
      submitLabel={user ? 'Save' : 'Add employee'}
      onClose={onClose}
      pending={save.isPending}
      disabled={!form.country || !form.department_id}
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
      <Choice label="Role" value={form.role} options={roles.map((r) => ({ value: r, label: roleLabel(r) }))} onChange={(v) => setForm({ ...form, role: v as Role })} />
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
          scope={['lookup']}
          fetchPeople={(search) => api<UserSummary[]>(`/users/lookup?search=${encodeURIComponent(search)}`)}
          selectedId={manager?.id}
          onPick={setManager}
          detail={(p) => `${roleLabel(p.role)} · ${p.job_title}`}
        />
      </div>

      {user && (
        <Choice
          label="Account active"
          value={form.is_active ? 'yes' : 'no'}
          options={[
            { value: 'yes', label: 'Active' },
            { value: 'no', label: 'Inactive' },
          ]}
          onChange={(v) => setForm({ ...form, is_active: v === 'yes' })}
          help="An inactive account can no longer sign in."
          segmented
        />
      )}
    </FormDialog>
  )
}
