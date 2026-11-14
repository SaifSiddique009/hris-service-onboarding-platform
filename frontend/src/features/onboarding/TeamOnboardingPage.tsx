import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import type { ChecklistCreate, ChecklistCreated, ChecklistSummary, Page, Template, User } from '../../api/types'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Field, Input, Select } from '../../components/Fields'
import { FormDialog } from '../../components/FormDialog'
import { PageHeader } from '../../components/PageHeader'
import { QueryBoundary } from '../../components/QueryBoundary'
import { errorText, formatDay } from '../../lib/format'
import { useAuth } from '../auth/AuthContext'
import { useCountries } from '../requests/queries'
import { PersonPicker } from './PersonPicker'
import { ProgressSummary } from './ProgressSummary'

const fetchEmployees = (search: string) =>
  api<Page<User>>(`/users?${new URLSearchParams({ page_size: '20', ...(search && { search }) })}`).then((p) => p.items)

function AssignDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const templates = useQuery({ queryKey: ['onboarding', 'templates'], queryFn: () => api<Template[]>('/onboarding/templates') })
  const [employee, setEmployee] = useState<User>()
  const [templateId, setTemplateId] = useState('')
  const [start, setStart] = useState('')
  const [created, setCreated] = useState<ChecklistCreated>()

  const open = (c: ChecklistCreated) => navigate(`/onboarding/checklists/${c.id}`)
  const assign = useMutation({
    mutationFn: (body: ChecklistCreate) =>
      api<ChecklistCreated>('/onboarding/checklists', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] })
      if (c.warnings.length) setCreated(c)
      else open(c)
    },
  })

  if (created) {
    return (
      <FormDialog title="Checklist assigned" submitLabel="Open checklist" pending={false} onClose={onClose} onSubmit={() => open(created)}>
        <div role="status" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Please check the following:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {created.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      </FormDialog>
    )
  }

  return (
    <FormDialog
      title="Assign checklist"
      submitLabel="Assign"
      onClose={onClose}
      pending={assign.isPending}
      disabled={!employee || !templateId}
      error={assign.error ? errorText(assign.error) : undefined}
      onSubmit={() =>
        assign.mutate({ employee_id: employee!.id, template_id: Number(templateId), start_date: start || null })
      }
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Employee</legend>
        <PersonPicker
          scope={['employees']}
          fetchPeople={fetchEmployees}
          selectedId={employee?.id}
          onPick={setEmployee}
          detail={(u) => `${u.department.name} · Joined ${formatDay(u.joining_date)}`}
        />
      </fieldset>
      <Field label="Template">
        <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          <option value="">Choose a template</option>
          {templates.data
            ?.filter((t) => t.is_active)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </Select>
      </Field>
      <Field
        label="Start date (optional)"
        hint={
          employee
            ? `Leave empty to use the employee's joining date, ${formatDay(employee.joining_date)}.`
            : "Leave empty to use the employee's joining date."
        }
      >
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      </Field>
    </FormDialog>
  )
}

function ChecklistCard({ c }: { c: ChecklistSummary }) {
  const { employee } = c
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500">
      <Link to={`/onboarding/checklists/${c.id}`} className="block focus:outline-none">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h2 className="font-semibold text-slate-900">{employee.full_name}</h2>
          <span className="text-xs text-slate-500">Start date {formatDay(c.start_date)}</span>
        </div>
        <p className="text-sm text-slate-600">
          {employee.job_title} · {employee.department.name} · {employee.country.name}
        </p>
        <p className="mb-3 text-xs text-slate-500">{c.template.name}</p>
        <ProgressSummary progress={c.progress} />
      </Link>
    </li>
  )
}

export function TeamOnboardingPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'HR_ADMIN'
  const [params, setParams] = useSearchParams()
  const [assigning, setAssigning] = useState(false)
  const countries = useCountries(isAdmin)

  const query = new URLSearchParams()
  for (const key of ['state', 'country']) if (params.get(key)) query.set(key, params.get(key)!)
  const list = useQuery({
    queryKey: ['onboarding', 'checklists', query.toString()],
    queryFn: () => api<ChecklistSummary[]>(`/onboarding/checklists?${query}`),
  })

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Team onboarding"
          subtitle={isAdmin ? 'Everyone currently being onboarded.' : 'New hires in your team.'}
        />
        {isAdmin && (
          <Button className="shrink-0" onClick={() => setAssigning(true)}>
            Assign checklist
          </Button>
        )}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select aria-label="State" value={params.get('state') ?? ''} onChange={(e) => update('state', e.target.value)} className="!mt-0">
          <option value="">All states</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </Select>
        {isAdmin && (
          <Select aria-label="Country" value={params.get('country') ?? ''} onChange={(e) => update('country', e.target.value)} className="!mt-0">
            <option value="">All countries</option>
            {countries.data?.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <QueryBoundary query={list}>
        {(items) =>
          items.length === 0 ? (
            <Card className="py-12 text-center text-sm text-slate-500">No onboarding checklists match these filters.</Card>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {items.map((c) => (
                <ChecklistCard key={c.id} c={c} />
              ))}
            </ul>
          )
        }
      </QueryBoundary>

      {assigning && <AssignDialog onClose={() => setAssigning(false)} />}
    </div>
  )
}
