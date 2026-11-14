import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import type { ChecklistCreate, ChecklistCreated, ChecklistSummary, Page, Template, User } from '../../api/types'
import { Button } from '../../components/Button'
import { Avatar } from '../../components/Avatar'
import { Card } from '../../components/Card'
import { ChipGroup } from '../../components/ChipGroup'
import { Field, Input } from '../../components/Fields'
import { FilterMenu } from '../../components/FilterMenu'
import { FormDialog } from '../../components/FormDialog'
import { PageHeader } from '../../components/PageHeader'
import { QueryBoundary } from '../../components/QueryBoundary'
import { EmptyState } from '../../components/States'
import { errorText, formatDay } from '../../lib/format'
import { toast } from '../../lib/toast'
import { useAuth } from '../auth/AuthContext'
import { useCountries } from '../requests/queries'
import { ChoiceField } from './ChoiceField'
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
      toast('Checklist assigned')
      if (c.warnings.length) setCreated(c)
      else open(c)
    },
  })

  if (created) {
    return (
      <FormDialog title="Checklist assigned" eyebrow="Onboarding" submitLabel="Open checklist" pending={false} onClose={onClose} onSubmit={() => open(created)}>
        <div role="status" className="rounded-sm bg-amber-soft p-3 text-sm text-amber">
          <p className="font-semibold">Please check the following:</p>
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
      eyebrow="Onboarding"
      submitLabel="Assign"
      onClose={onClose}
      pending={assign.isPending}
      disabled={!employee || !templateId}
      error={assign.error ? errorText(assign.error) : undefined}
      onSubmit={() =>
        assign.mutate({ employee_id: employee!.id, template_id: Number(templateId), start_date: start || null })
      }
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1.5 text-[13px] font-semibold">Employee</legend>
        <PersonPicker
          scope={['employees']}
          fetchPeople={fetchEmployees}
          selectedId={employee?.id}
          onPick={setEmployee}
          detail={(u) => `${u.department.name} · Joined ${formatDay(u.joining_date)}`}
        />
      </fieldset>
      <ChoiceField label="Template">
        <ChipGroup
          label="Template"
          value={templateId}
          onChange={setTemplateId}
          options={(templates.data ?? []).filter((t) => t.is_active).map((t) => ({ value: String(t.id), label: t.name }))}
        />
      </ChoiceField>
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
  const { employee, progress } = c
  const attention = progress.overdue > 0 || progress.blocked > 0
  return (
    <li>
      <Link
        to={`/onboarding/checklists/${c.id}`}
        className="block text-ink no-underline transition-colors hover:bg-[#f0efe6] hover:text-ink"
      >
        <Card variant={attention ? 'attention' : 'emphasis'} className="pb-5">
          <div className="flex items-start gap-3">
            <Avatar name={employee.full_name} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <h2 className="font-serif text-[21px] leading-snug">{employee.full_name}</h2>
                <span className="text-[13px] tabular-nums text-muted">Starts {formatDay(c.start_date)}</span>
              </div>
              <p className="text-[13px] text-muted">
                {employee.job_title} · {employee.department.name} · {employee.country.name}
              </p>
              <p className="mb-4 text-[13px] text-muted">{c.template.name}</p>
              <ProgressSummary progress={progress} />
            </div>
          </div>
        </Card>
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
    <>
      <PageHeader
        title="Team onboarding"
        eyebrow="Onboarding"
        subtitle="New hires and their onboarding progress."
        actions={isAdmin && <Button onClick={() => setAssigning(true)}>Assign checklist</Button>}
      />

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <ChipGroup
          segmented
          label="State"
          value={params.get('state') ?? ''}
          onChange={(v) => update('state', v)}
          options={[
            { value: '', label: 'All states' },
            { value: 'active', label: 'Active' },
            { value: 'completed', label: 'Completed' },
          ]}
        />
        {isAdmin && (
          <FilterMenu
            label="Country"
            value={params.get('country') ?? ''}
            onChange={(v) => update('country', v)}
            options={(countries.data ?? []).map((c) => ({ value: c.code, label: c.name }))}
          />
        )}
      </div>

      <QueryBoundary query={list}>
        {(items) =>
          items.length === 0 ? (
            params.size > 0 ? (
              <EmptyState
                title="No checklists match these filters."
                help="Try another state or country."
                action={
                  <Button variant="secondary" onClick={() => setParams({})}>
                    Clear filters
                  </Button>
                }
              />
            ) : isAdmin ? (
              <EmptyState
                title="No onboarding checklists yet."
                help="Assign a template to a new hire to start one."
                action={<Button onClick={() => setAssigning(true)}>Assign checklist</Button>}
              />
            ) : (
              <EmptyState title="No one in your team is being onboarded." />
            )
          ) : (
            <ul className="grid grid-cols-1 gap-x-10 gap-y-10 lg:grid-cols-2">
              {items.map((c) => (
                <ChecklistCard key={c.id} c={c} />
              ))}
            </ul>
          )
        }
      </QueryBoundary>

      {assigning && <AssignDialog onClose={() => setAssigning(false)} />}
    </>
  )
}
