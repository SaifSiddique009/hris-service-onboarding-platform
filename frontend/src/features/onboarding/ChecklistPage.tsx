import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type ApiError } from '../../api/client'
import type { ChecklistDetail, OnboardingTaskDetail, TaskUpdate, UserSummary } from '../../api/types'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Field, Input, Select } from '../../components/Fields'
import { FormDialog } from '../../components/FormDialog'
import { PageHeader } from '../../components/PageHeader'
import { QueryBoundary } from '../../components/QueryBoundary'
import { errorText, formatDateTime, formatDay, label } from '../../lib/format'
import { useAuth } from '../auth/AuthContext'
import { useDepartments } from '../requests/queries'
import { PersonPicker } from './PersonPicker'
import { ProgressSummary } from './ProgressSummary'
import { TaskCard } from './TaskCard'

function TaskHistory({ task }: { task: OnboardingTaskDetail }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
        History
      </summary>
      <ul className="mt-2 space-y-1 border-l-2 border-slate-200 pl-3 text-slate-600">
        {task.history.map((e, i) => (
          <li key={i}>
            {e.note ?? (e.from_status ? `${label(e.from_status)} to ${label(e.to_status)}` : 'Created')}
            <span className="block text-xs text-slate-500">
              {e.actor.full_name} · {formatDateTime(e.created_at)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}

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
      submitLabel="Save"
      onClose={onClose}
      pending={save.isPending}
      disabled={!assignee && !dueChanged}
      error={save.error ? errorText(save.error) : undefined}
      onSubmit={() => save.mutate({ assignee_id: assignee, due_date: dueChanged ? due : undefined })}
    >
      <p className="text-sm text-slate-600">
        {task.title}. Current assignee: {task.assignee.full_name}.
      </p>
      <Field label="Department">
        <Select value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">Everyone</option>
          {departments?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>
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
      <Button variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open && <EditTaskDialog task={task} onClose={() => setOpen(false)} />}
    </>
  )
}

export function ChecklistView({ path, title }: { path: string; title?: string }) {
  const { user } = useAuth()
  const query = useQuery<ChecklistDetail, ApiError>({
    queryKey: ['onboarding', 'checklist', path],
    queryFn: () => api(path),
  })

  if (query.error?.status === 404) {
    return <Card className="py-12 text-center text-sm text-slate-500">{query.error.message}</Card>
  }

  return (
    <QueryBoundary query={query}>
      {(c) => (
        <>
          <PageHeader
            title={title ?? c.employee.full_name}
            subtitle={`${c.employee.job_title} · ${c.employee.department.name} · ${c.employee.country.name}`}
          />
          <Card className="mb-6">
            <p className="mb-4 text-sm text-slate-600">
              Start date {formatDay(c.start_date)} · {c.template.name}
            </p>
            <ProgressSummary progress={c.progress} />
          </Card>
          <ul className="space-y-3">
            {c.tasks.map((t) => (
              <TaskCard key={t.id} task={t}>
                <TaskHistory task={t} />
                {user?.role === 'HR_ADMIN' && <EditTask task={t} />}
              </TaskCard>
            ))}
          </ul>
        </>
      )}
    </QueryBoundary>
  )
}

export function ChecklistPage() {
  const { id } = useParams()
  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/onboarding" className="mb-3 inline-block text-sm text-indigo-700 hover:underline">
        Back to team onboarding
      </Link>
      <ChecklistView path={`/onboarding/checklists/${id}`} />
    </div>
  )
}
