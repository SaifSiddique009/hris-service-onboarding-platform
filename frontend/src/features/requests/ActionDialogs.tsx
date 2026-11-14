import { useMutation, useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { RequestAction, RequestDetail, UserSummary } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { ChipGroup } from '../../components/ChipGroup'
import { Field, SearchInput, Textarea } from '../../components/Fields'
import { FormDialog as Form } from '../../components/FormDialog'
import { cn } from '../../lib/cn'
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
    <Form
      title={`${label(action)} request`}
      eyebrow={request.reference}
      submitLabel={label(action)}
      onClose={onClose}
      onSubmit={mutation.mutate}
      pending={mutation.isPending}
    >
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
  const [chosen, setChosen] = useState<UserSummary>()
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
    mutationFn: () => post(request.id, action, { assignee_id: chosen?.id, note: note.trim() || null }),
    onSuccess: onDone,
    onError,
  })

  return (
    <Form
      title={`${label(action)} request`}
      eyebrow={request.reference}
      submitLabel={chosen ? `${label(action)} to ${chosen.full_name}` : label(action)}
      onClose={onClose}
      onSubmit={mutation.mutate}
      pending={mutation.isPending}
      disabled={!chosen}
    >
      <ChipGroup
        label="Department"
        value={department}
        onChange={setDepartment}
        options={[{ value: '', label: 'Everyone' }, ...(departments ?? []).map((d) => ({ value: String(d.id), label: d.name }))]}
      />
      <SearchInput placeholder="Search by name" aria-label="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div role="radiogroup" aria-label="Assignee" className="max-h-[300px] overflow-y-auto border-t border-ink">
        {people.isPending ? (
          <p className="p-6 text-sm text-n-600">Loading people…</p>
        ) : people.isError ? (
          <p role="alert" className="p-6 text-sm text-danger">
            {people.error.message}
          </p>
        ) : people.data.length === 0 ? (
          <p className="p-6 text-sm text-n-600">No one matches. Try another department or name.</p>
        ) : (
          people.data.map((u) => {
            const checked = chosen?.id === u.id
            return (
              <button
                key={u.id}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setChosen(u)}
                className={cn(
                  'grid min-h-14 w-full grid-cols-[36px_1fr_auto] items-center gap-3 border-b border-l-[3px] border-b-line border-l-transparent py-2 pl-[11px] pr-3.5 text-left hover:bg-[#f0f2ec]',
                  checked && 'border-l-accent bg-accent-soft',
                )}
              >
                <Avatar name={u.full_name} active={checked} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-[14.5px] font-semibold">
                    {u.full_name}
                    {request.assignee?.id === u.id && (
                      <span className="rounded-xs border border-control px-1.5 text-[11px] font-bold uppercase">Current</span>
                    )}
                  </span>
                  <span className="block text-[12.5px] text-muted">
                    {u.job_title} · {u.department.name}
                  </span>
                </span>
                {checked && <Check aria-hidden size={16} strokeWidth={1.8} className="text-accent" />}
              </button>
            )
          })
        )}
      </div>
      <Field label="Note (optional)">
        <Textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Form>
  )
}

export const ActionDialog = (props: Props) =>
  props.action === 'assign' || props.action === 'reassign' ? <AssignDialog {...props} /> : <TransitionDialog {...props} />
