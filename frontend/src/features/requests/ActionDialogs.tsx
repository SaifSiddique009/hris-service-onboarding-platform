import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { RequestAction, RequestDetail, UserSummary } from '../../api/types'
import { Field, Input, Select, Textarea } from '../../components/Fields'
import { FormDialog as Form } from '../../components/FormDialog'
import { label } from '../../lib/format'
import { useCategories, useDepartments } from './queries'

const post = (id: number, path: string, body: object) =>
  api<RequestDetail>(`/requests/${id}/${path}`, { method: 'POST', body: JSON.stringify(body) })

interface Props {
  request: RequestDetail
  action: RequestAction
  onClose: () => void
  onDone: (updated: RequestDetail) => void
  onError: (err: Error) => void
}

const noteRequired: RequestAction[] = ['reject', 'resolve', 'reopen']

function TransitionDialog({ request, action, onClose, onDone, onError }: Props) {
  const [note, setNote] = useState('')
  const required = noteRequired.includes(action)
  const mutation = useMutation({
    mutationFn: () => post(request.id, 'transitions', { action, note: note.trim() || null }),
    onSuccess: onDone,
    onError,
  })

  return (
    <Form title={`${label(action)} request`} onClose={onClose} onSubmit={mutation.mutate} pending={mutation.isPending}>
      <Field label={required ? 'Note' : 'Note (optional)'}>
        <Textarea required={required} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Form>
  )
}

function AssignDialog({ request, action, onClose, onDone, onError }: Props) {
  const { data: departments } = useDepartments()
  const { data: categories } = useCategories()
  const owner = categories?.find((c) => c.id === request.category.id)?.owning_department?.id
  // Until the user picks one, follow the category's owning department once it has loaded.
  const [picked, setDepartment] = useState<string>()
  const department = picked ?? (owner ? String(owner) : '')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [assigneeId, setAssigneeId] = useState<number>()
  const [note, setNote] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const people = useQuery({
    queryKey: ['lookup', department, debounced],
    queryFn: () => {
      const q = new URLSearchParams()
      if (department) q.set('department_id', department)
      if (debounced) q.set('search', debounced)
      return api<UserSummary[]>(`/users/lookup?${q}`)
    },
  })

  const mutation = useMutation({
    mutationFn: () => post(request.id, action, { assignee_id: assigneeId, note: note.trim() || null }),
    onSuccess: onDone,
    onError,
  })

  return (
    <Form
      title={`${label(action)} request`}
      onClose={onClose}
      onSubmit={mutation.mutate}
      pending={mutation.isPending}
      disabled={!assigneeId}
    >
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
      <Field label="Search by name">
        <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Field>
      <fieldset>
        <legend className="text-sm font-medium text-slate-700">Assignee</legend>
        <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-slate-300">
          {people.isPending ? (
            <p className="p-3 text-sm text-slate-500">Loading people...</p>
          ) : people.isError ? (
            <p role="alert" className="p-3 text-sm text-red-600">
              {people.error.message}
            </p>
          ) : people.data.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">No people found.</p>
          ) : (
            people.data.map((u) => (
              <label key={u.id} className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                <input
                  type="radio"
                  name="assignee"
                  checked={assigneeId === u.id}
                  onChange={() => setAssigneeId(u.id)}
                  className="mt-1 accent-indigo-600"
                />
                <span>
                  <span className="block font-medium">{u.full_name}</span>
                  <span className="block text-xs text-slate-500">
                    {u.job_title} · {u.department.name}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>
      </fieldset>
      <Field label="Note (optional)">
        <Textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Form>
  )
}

export const ActionDialog = (props: Props) =>
  props.action === 'assign' || props.action === 'reassign' ? <AssignDialog {...props} /> : <TransitionDialog {...props} />
