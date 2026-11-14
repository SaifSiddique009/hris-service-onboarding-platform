import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CornerUpLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../api/client'
import type { DeadlineUnit, TaskOwnerKind, TemplateDetail, TemplateTask, TemplateTaskInput } from '../../api/types'
import { Button } from '../../components/Button'
import { ChipGroup } from '../../components/ChipGroup'
import { Field, Input, Select, Textarea } from '../../components/Fields'
import { FormDialog } from '../../components/FormDialog'
import { PageHeader } from '../../components/PageHeader'
import { QueryBoundary } from '../../components/QueryBoundary'
import { EmptyState } from '../../components/States'
import { errorText } from '../../lib/format'
import { useOnce } from '../../lib/once'
import { toast } from '../../lib/toast'
import { useDepartments } from '../requests/queries'
import { ChoiceField } from './ChoiceField'

const json = (method: string, body?: object) => ({ method, body: body && JSON.stringify(body) })

function useTemplateMutation<V = void>(id: number, fn: (v: V) => Promise<unknown>, message: string, onSuccess?: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding', 'template', id] })
      queryClient.invalidateQueries({ queryKey: ['onboarding', 'templates'] })
      toast(message)
      onSuccess?.()
    },
  })
}

function TemplateForm({ template }: { template: TemplateDetail }) {
  const [name, setName] = useState(template.name)
  const [description, setDescription] = useState(template.description)
  const once = useOnce()
  const save = useTemplateMutation(
    template.id,
    (body: object) => api(`/onboarding/templates/${template.id}`, json('PATCH', body)),
    'Changes saved',
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!save.isPending) once(() => save.mutate({ name: name.trim(), description: description.trim() }))
      }}
      className="mb-14 flex max-w-2xl flex-col gap-4"
    >
      <Field label="Name">
        <Input required minLength={3} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Description">
        <Textarea rows={3} required minLength={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      {save.isError && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {errorText(save.error)}
        </p>
      )}
      <div>
        <Button type="submit" variant="secondary" loading={save.isPending}>
          Save changes
        </Button>
      </div>
    </form>
  )
}

function ActiveSwitch({ template }: { template: TemplateDetail }) {
  const toggle = useTemplateMutation(
    template.id,
    () => api(`/onboarding/templates/${template.id}`, json('PATCH', { is_active: !template.is_active })),
    template.is_active ? 'Template deactivated' : 'Template activated',
  )
  const on = template.is_active

  return (
    <div className="mb-8 flex items-start gap-3 border-t border-line py-4">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="active-label"
        aria-describedby="active-help"
        disabled={toggle.isPending}
        onClick={() => toggle.mutate()}
        className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-xl transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60 ${on ? 'bg-accent' : 'bg-n-400'}`}
      >
        <span
          aria-hidden
          className={`absolute left-[3px] top-[3px] size-[18px] rounded-full bg-paper shadow-sm transition-transform duration-200 ${on ? 'translate-x-4' : ''}`}
        />
      </button>
      <div className="min-w-0 text-sm">
        <p id="active-label" className="font-semibold">
          Active
        </p>
        <p id="active-help" className="text-muted">
          When off, this template can no longer be assigned to a new hire. Existing checklists are not changed.
        </p>
        {toggle.isError && (
          <p role="alert" className="mt-1 text-[13px] font-medium text-danger">
            {errorText(toggle.error)}
          </p>
        )}
      </div>
    </div>
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
    task ? 'Changes saved' : 'Task added',
    onClose,
  )

  return (
    <FormDialog
      title={task ? 'Edit task' : 'Add task'}
      eyebrow="Template"
      submitLabel="Save"
      onClose={onClose}
      pending={save.isPending}
      disabled={kind === 'DEPARTMENT' && !department}
      error={save.error ? errorText(save.error) : undefined}
      onSubmit={save.mutate}
    >
      <Field label="Title">
        <Input required minLength={3} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Description">
        <Textarea rows={3} required minLength={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <ChoiceField label="Owner">
        <ChipGroup
          label="Owner"
          value={kind}
          onChange={(v) => setKind(v as TaskOwnerKind)}
          options={[
            { value: 'DEPARTMENT', label: 'Department' },
            { value: 'LINE_MANAGER', label: 'Line manager' },
          ]}
        />
      </ChoiceField>
      {kind === 'DEPARTMENT' && (
        <ChoiceField label="Department">
          <ChipGroup
            label="Department"
            value={department}
            onChange={setDepartment}
            options={(departments ?? []).map((d) => ({ value: String(d.id), label: d.name }))}
          />
        </ChoiceField>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ChoiceField label="Deadline unit">
          <ChipGroup
            label="Deadline unit"
            value={unit}
            onChange={(v) => setUnit(v as DeadlineUnit)}
            options={[
              { value: 'DAY', label: 'Day' },
              { value: 'WEEK', label: 'Week' },
            ]}
          />
        </ChoiceField>
        <Field label="Deadline value">
          <Input type="number" required min={1} max={365} value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
      </div>
      <p className="-mt-2 text-[13px] text-muted">Day 1 is the start date. Week 1 ends on day 7.</p>
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
    'Task deleted',
    onClose,
  )
  return (
    <FormDialog
      title="Delete task"
      eyebrow="Template"
      submitLabel="Delete"
      danger
      onClose={onClose}
      pending={remove.isPending}
      error={remove.error?.message}
      onSubmit={remove.mutate}
    >
      <p className="text-sm text-n-600">Delete "{task.title}" from this template? Existing checklists are not changed.</p>
    </FormDialog>
  )
}

function TaskList({ template }: { template: TemplateDetail }) {
  const [editing, setEditing] = useState<TemplateTask | 'new'>()
  const [deleting, setDeleting] = useState<TemplateTask>()
  const titleOf = (id: number) => template.tasks.find((t) => t.id === id)?.title

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink pt-4">
        <h2 className="font-serif text-[28px] leading-[1.2]">Tasks</h2>
        <Button onClick={() => setEditing('new')}>
          <Plus aria-hidden size={16} strokeWidth={1.8} />
          Add task
        </Button>
      </div>
      {template.tasks.length === 0 ? (
        <EmptyState title="This template has no tasks yet" help="Add the first task a new hire should complete." />
      ) : (
        <div className="border-t border-ink">
          <div className="grid grid-cols-[44px_minmax(0,1fr)_150px_110px_88px] gap-5 border-b border-control py-3 text-[11.5px] font-semibold uppercase tracking-[.06em] text-muted max-md:hidden">
            <span>#</span>
            <span>Task</span>
            <span>Owner</span>
            <span>Deadline</span>
            <span />
          </div>
          <ol>
            {template.tasks.map((t, i) => (
              <li
                key={t.id}
                className="grid grid-cols-[44px_minmax(0,1fr)_150px_110px_88px] items-start gap-5 border-b border-line py-[18px] max-md:grid-cols-[28px_minmax(0,1fr)] max-md:gap-x-2.5 max-md:gap-y-1.5"
              >
                <span className="font-serif text-lg tabular-nums text-muted">{String(i + 1).padStart(2, '0')}</span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold">{t.title}</h3>
                  <p className="mt-0.5 text-[13px] text-muted">{t.description}</p>
                  {t.depends_on_task_id && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-plum">
                      <CornerUpLeft aria-hidden size={14} strokeWidth={1.8} />
                      <span>
                        Waits for <strong>{titleOf(t.depends_on_task_id)}</strong>
                      </span>
                    </p>
                  )}
                </div>
                <span className="text-sm max-md:col-start-2">
                  <span className="text-muted md:hidden">Owner: </span>
                  {t.owner_department?.name ?? 'Line manager'}
                </span>
                <span className="text-sm font-semibold max-md:col-start-2">
                  <span className="font-normal text-muted md:hidden">Due: </span>
                  {t.deadline_label}
                </span>
                <span className="flex justify-end gap-0.5 max-md:col-start-2 max-md:justify-start">
                  <Button size="icon" variant="ghost" aria-label={`Edit ${t.title}`} onClick={() => setEditing(t)}>
                    <Pencil aria-hidden size={16} strokeWidth={1.8} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${t.title}`}
                    className="text-n-500 hover:bg-danger-soft hover:text-danger"
                    onClick={() => setDeleting(t)}
                  >
                    <Trash2 aria-hidden size={16} strokeWidth={1.8} />
                  </Button>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {editing && (
        <TaskDialog template={template} task={editing === 'new' ? undefined : editing} onClose={() => setEditing(undefined)} />
      )}
      {deleting && <DeleteDialog template={template} task={deleting} onClose={() => setDeleting(undefined)} />}
    </section>
  )
}

export function TemplateDetailPage() {
  const { id } = useParams()
  const query = useQuery({
    queryKey: ['onboarding', 'template', Number(id)],
    queryFn: () => api<TemplateDetail>(`/onboarding/templates/${id}`),
  })

  return (
    <>
      <PageHeader title={query.data?.name ?? 'Template'} eyebrow="Template" back={{ to: '/onboarding/templates', label: 'Templates' }} />
      <QueryBoundary query={query}>
        {(t) => (
          <>
            <ActiveSwitch template={t} />
            <TemplateForm key={t.updated_at} template={t} />
            <TaskList template={t} />
          </>
        )}
      </QueryBoundary>
    </>
  )
}
