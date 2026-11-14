import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../api/client'
import type { DeadlineUnit, TaskOwnerKind, TemplateDetail, TemplateTask, TemplateTaskInput } from '../../api/types'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { ChipGroup } from '../../components/ChipGroup'
import { Field, Input, Select, Textarea } from '../../components/Fields'
import { FormDialog } from '../../components/FormDialog'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { QueryBoundary } from '../../components/QueryBoundary'
import { EmptyState } from '../../components/States'
import { errorText } from '../../lib/format'
import { useDepartments } from '../requests/queries'
import { ChoiceField } from './ChoiceField'
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
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate({ name: name.trim(), description: description.trim() })
        }}
        className="flex max-w-2xl flex-col gap-4"
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
    onClose,
  )
  return (
    <Modal
      title="Delete task"
      eyebrow="Template"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
            Delete
          </Button>
        </>
      }
    >
      <p className="text-sm text-n-600">Delete "{task.title}" from this template? Existing checklists are not changed.</p>
      {remove.isError && (
        <p role="alert" className="mt-3 text-[13px] font-medium text-danger">
          {remove.error.message}
        </p>
      )}
    </Modal>
  )
}

function TaskList({ template }: { template: TemplateDetail }) {
  const [editing, setEditing] = useState<TemplateTask | 'new'>()
  const [deleting, setDeleting] = useState<TemplateTask>()
  const titleOf = (id: number) => template.tasks.find((t) => t.id === id)?.title

  return (
    <section className="mt-14">
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
        <ol className="border-t border-line">
          {template.tasks.map((t, i) => (
            <li
              key={t.id}
              className="grid grid-cols-[44px_1fr] gap-4 border-b border-line py-6 pl-3.5 pr-5 max-md:grid-cols-[28px_1fr] max-md:gap-2.5 max-md:pr-3"
            >
              <span className="font-serif text-xl tabular-nums text-muted">{String(i + 1).padStart(2, '0')}</span>
              <div className="min-w-0">
                <h3 className="text-[15.5px] font-semibold">{t.title}</h3>
                <p className="mt-1 text-[13.5px] text-muted">{t.description}</p>
                <dl className="mt-3 flex flex-wrap gap-x-7 gap-y-1.5 text-[13px]">
                  <div className="flex gap-1.5">
                    <dt className="text-muted">Owner</dt>
                    <dd>{t.owner_department?.name ?? 'Line manager'}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-muted">Due</dt>
                    <dd>{t.deadline_label}</dd>
                  </div>
                  {t.depends_on_task_id && (
                    <div className="flex gap-1.5">
                      <dt className="text-muted">Waits for</dt>
                      <dd>{titleOf(t.depends_on_task_id)}</dd>
                    </div>
                  )}
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(t)}>
                    <Pencil aria-hidden size={16} strokeWidth={1.8} />
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleting(t)}>
                    <Trash2 aria-hidden size={16} strokeWidth={1.8} />
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
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
            <TemplateForm key={t.updated_at} template={t} />
            <TaskList template={t} />
          </>
        )}
      </QueryBoundary>
    </>
  )
}
