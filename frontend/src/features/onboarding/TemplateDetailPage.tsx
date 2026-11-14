import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import type { DeadlineUnit, TaskOwnerKind, TemplateDetail, TemplateTask, TemplateTaskInput } from '../../api/types'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Field, Input, Select, Textarea } from '../../components/Fields'
import { FormDialog } from '../../components/FormDialog'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { QueryBoundary } from '../../components/QueryBoundary'
import { errorText } from '../../lib/format'
import { useDepartments } from '../requests/queries'
import { ActiveBadge } from './TemplatesPage'

const json = (method: string, body?: object) => ({ method, body: body && JSON.stringify(body) })

function useTemplateMutation<V = void>(id: number, fn: (v: V) => Promise<unknown>, onSuccess?: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding', 'template', id] })
      queryClient.invalidateQueries({ queryKey: ['onboarding', 'templates'] })
      onSuccess?.()
    },
  })
}

function TemplateForm({ template }: { template: TemplateDetail }) {
  const [name, setName] = useState(template.name)
  const [description, setDescription] = useState(template.description)
  const save = useTemplateMutation(template.id, (body: object) =>
    api(`/onboarding/templates/${template.id}`, json('PATCH', body)),
  )

  return (
    <Card className="mb-6">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate({ name: name.trim(), description: description.trim() })
        }}
        className="space-y-4"
      >
        <Field label="Name">
          <Input required minLength={3} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description">
          <Textarea rows={3} required minLength={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {save.isError && (
          <p role="alert" className="text-sm text-red-600">
            {errorText(save.error)}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" loading={save.isPending}>
            Save changes
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={save.isPending}
            onClick={() => save.mutate({ is_active: !template.is_active })}
          >
            {template.is_active ? 'Deactivate' : 'Activate'}
          </Button>
          <ActiveBadge active={template.is_active} />
        </div>
      </form>
    </Card>
  )
}

function TaskDialog({ template, task, onClose }: { template: TemplateDetail; task?: TemplateTask; onClose: () => void }) {
  const { data: departments } = useDepartments()
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [kind, setKind] = useState<TaskOwnerKind>(task?.owner_kind ?? 'DEPARTMENT')
  const [department, setDepartment] = useState(String(task?.owner_department?.id ?? ''))
  const [unit, setUnit] = useState<DeadlineUnit>(task?.deadline_unit ?? 'DAY')
  const [value, setValue] = useState(String(task?.deadline_value ?? 1))
  const [dependsOn, setDependsOn] = useState(String(task?.depends_on_task_id ?? ''))

  const save = useTemplateMutation(
    template.id,
    () => {
      const body: TemplateTaskInput = {
        title: title.trim(),
        description: description.trim(),
        owner_kind: kind,
        owner_department_id: kind === 'DEPARTMENT' ? Number(department) || null : null,
        deadline_unit: unit,
        deadline_value: Number(value),
        depends_on_task_id: Number(dependsOn) || null,
      }
      const base = `/onboarding/templates/${template.id}/tasks`
      return task ? api(`${base}/${task.id}`, json('PATCH', body)) : api(base, json('POST', body))
    },
    onClose,
  )

  return (
    <FormDialog
      title={task ? 'Edit task' : 'Add task'}
      submitLabel="Save"
      onClose={onClose}
      pending={save.isPending}
      error={save.error ? errorText(save.error) : undefined}
      onSubmit={save.mutate}
    >
      <Field label="Title">
        <Input required minLength={3} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Description">
        <Textarea rows={3} required minLength={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Owner">
        <Select value={kind} onChange={(e) => setKind(e.target.value as TaskOwnerKind)}>
          <option value="DEPARTMENT">Department</option>
          <option value="LINE_MANAGER">Line manager</option>
        </Select>
      </Field>
      {kind === 'DEPARTMENT' && (
        <Field label="Department">
          <Select required value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">Choose a department</option>
            {departments?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Deadline unit">
          <Select value={unit} onChange={(e) => setUnit(e.target.value as DeadlineUnit)}>
            <option value="DAY">Day</option>
            <option value="WEEK">Week</option>
          </Select>
        </Field>
        <Field label="Deadline value">
          <Input type="number" required min={1} max={365} value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-slate-500">Day 1 is the start date. Week 1 ends on day 7.</p>
      <Field label="Waits for">
        <Select value={dependsOn} onChange={(e) => setDependsOn(e.target.value)}>
          <option value="">Nothing</option>
          {template.tasks
            .filter((t) => t.id !== task?.id)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
        </Select>
      </Field>
    </FormDialog>
  )
}

function DeleteDialog({ template, task, onClose }: { template: TemplateDetail; task: TemplateTask; onClose: () => void }) {
  const remove = useTemplateMutation(
    template.id,
    () => api(`/onboarding/templates/${template.id}/tasks/${task.id}`, json('DELETE')),
    onClose,
  )
  return (
    <Modal title="Delete task" onClose={onClose}>
      <p className="text-sm text-slate-600">Delete "{task.title}" from this template? Existing checklists are not changed.</p>
      {remove.isError && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {remove.error.message}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={remove.isPending} onClick={() => remove.mutate()}>
          Delete
        </Button>
      </div>
    </Modal>
  )
}

function TaskList({ template }: { template: TemplateDetail }) {
  const [editing, setEditing] = useState<TemplateTask | 'new'>()
  const [deleting, setDeleting] = useState<TemplateTask>()
  const titleOf = (id: number) => template.tasks.find((t) => t.id === id)?.title

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Tasks</h2>
        <Button onClick={() => setEditing('new')}>Add task</Button>
      </div>
      {template.tasks.length === 0 ? (
        <Card className="py-12 text-center text-sm text-slate-500">This template has no tasks yet.</Card>
      ) : (
        <ol className="space-y-3">
          {template.tasks.map((t) => (
            <li key={t.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-medium">{t.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{t.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setEditing(t)}>
                    Edit
                  </Button>
                  <Button variant="secondary" onClick={() => setDeleting(t)}>
                    Delete
                  </Button>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Owner: <span className="text-slate-700">{t.owner_department?.name ?? 'Line manager'}</span> · Due:{' '}
                <span className="text-slate-700">{t.deadline_label}</span>
                {t.depends_on_task_id && (
                  <>
                    {' '}
                    · Waits for <span className="text-slate-700">{titleOf(t.depends_on_task_id)}</span>
                  </>
                )}
              </p>
            </li>
          ))}
        </ol>
      )}
      {editing && (
        <TaskDialog template={template} task={editing === 'new' ? undefined : editing} onClose={() => setEditing(undefined)} />
      )}
      {deleting && <DeleteDialog template={template} task={deleting} onClose={() => setDeleting(undefined)} />}
    </>
  )
}

export function TemplateDetailPage() {
  const { id } = useParams()
  const query = useQuery({
    queryKey: ['onboarding', 'template', Number(id)],
    queryFn: () => api<TemplateDetail>(`/onboarding/templates/${id}`),
  })

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/onboarding/templates" className="mb-3 inline-block text-sm text-indigo-700 hover:underline">
        Back to templates
      </Link>
      <PageHeader title="Template" />
      <QueryBoundary query={query}>
        {(t) => (
          <>
            <TemplateForm key={t.updated_at} template={t} />
            <TaskList template={t} />
          </>
        )}
      </QueryBoundary>
    </div>
  )
}
