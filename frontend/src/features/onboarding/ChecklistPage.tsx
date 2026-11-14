import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, type ApiError } from '../../api/client'
import type { ChecklistDetail, OnboardingTaskDetail, TaskUpdate, UserSummary } from '../../api/types'
import { Button } from '../../components/Button'
import { ChipGroup } from '../../components/ChipGroup'
import { Field, Input } from '../../components/Fields'
import { FormDialog } from '../../components/FormDialog'
import { PageHeader } from '../../components/PageHeader'
import { QueryBoundary } from '../../components/QueryBoundary'
import { EmptyState } from '../../components/States'
import { errorText, formatDay } from '../../lib/format'
import { useAuth } from '../auth/AuthContext'
import { useDepartments } from '../requests/queries'
import { ChoiceField } from './ChoiceField'
import { PersonPicker } from './PersonPicker'
import { ProgressSummary } from './ProgressSummary'
import { TaskCard } from './TaskCard'

function EditTaskDialog({ task, onClose }: { task: OnboardingTaskDetail; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: departments } = useDepartments()
  const [department, setDepartment] = useState(String(task.owner_department?.id ?? ''))
  const [assignee, setAssignee] = useState<number>()
  const [due, setDue] = useState(task.due_date)

  const save = useMutation({
    mutationFn: (body: TaskUpdate) => api(`/onboarding/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] })
      onClose()
    },
  })
  const dueChanged = due !== '' && due !== task.due_date

  const fetchPeople = (search: string) => {
    const q = new URLSearchParams()
    if (department) q.set('department_id', department)
    if (search) q.set('search', search)
    return api<UserSummary[]>(`/users/lookup?${q}`)
  }

  return (
    <FormDialog
      title="Edit task"
      eyebrow="Onboarding"
      submitLabel="Save"
      onClose={onClose}
      pending={save.isPending}
      disabled={!assignee && !dueChanged}
      error={save.error ? errorText(save.error) : undefined}
      onSubmit={() => save.mutate({ assignee_id: assignee, due_date: dueChanged ? due : undefined })}
    >
      <p className="text-sm text-n-600">
        {task.title}. Current assignee: {task.assignee.full_name}.
      </p>
      <ChoiceField label="Department">
        <ChipGroup
          label="Department"
          value={department}
          onChange={setDepartment}
          options={[{ value: '', label: 'Everyone' }, ...(departments ?? []).map((d) => ({ value: String(d.id), label: d.name }))]}
        />
      </ChoiceField>
      <PersonPicker
        scope={['lookup', department]}
        fetchPeople={fetchPeople}
        selectedId={assignee}
        onPick={(p) => setAssignee(p.id)}
        detail={(p) => `${p.job_title} · ${p.department.name}`}
      />
      <Field label="Due date">
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </Field>
    </FormDialog>
  )
}

function EditTask({ task }: { task: OnboardingTaskDetail }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Pencil aria-hidden size={16} strokeWidth={1.8} />
        Edit
      </Button>
      {open && <EditTaskDialog task={task} onClose={() => setOpen(false)} />}
    </>
  )
}

export function ChecklistView({ path, title, back }: { path: string; title?: string; back?: { to: string; label: string } }) {
  const { user } = useAuth()
  const query = useQuery<ChecklistDetail, ApiError>({
    queryKey: ['onboarding', 'checklist', path],
    queryFn: () => api(path),
  })

  if (query.error?.status === 404) {
    return (
      <>
        <PageHeader title={title ?? 'Checklist'} eyebrow="Onboarding" back={back} />
        <EmptyState title="No checklist yet" help={query.error.message} />
      </>
    )
  }

  return (
    <QueryBoundary query={query}>
      {(c) => {
        const numbers = new Map(c.tasks.map((t, i) => [t.id, i + 1]))
        return (
          <>
            <PageHeader
              title={title ?? c.employee.full_name}
              eyebrow="Onboarding"
              back={back}
              subtitle={`${c.employee.job_title} · ${c.employee.department.name} · ${c.employee.country.name}`}
            />
            <div className="max-w-xl border-t-2 border-ink pt-3.5">
              <p className="mb-4 text-[13px] text-muted">
                Start date {formatDay(c.start_date)} · {c.template.name}
              </p>
              <ProgressSummary progress={c.progress} />
            </div>
            <ol className="mt-14 border-t border-ink">
              {c.tasks.map((t) => (
                <TaskCard key={t.id} task={t} number={numbers.get(t.id)} numbers={numbers} history={t.history}>
                  {user?.role === 'HR_ADMIN' && <EditTask task={t} />}
                </TaskCard>
              ))}
            </ol>
          </>
        )
      }}
    </QueryBoundary>
  )
}

export function ChecklistPage() {
  const { id } = useParams()
  return (
    <ChecklistView path={`/onboarding/checklists/${id}`} back={{ to: '/onboarding', label: 'Team onboarding' }} />
  )
}
