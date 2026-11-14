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
import { errorText } from '../../lib/format'
import { toast } from '../../lib/toast'
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
const outcome: Partial<Record<RequestAction, { button: string; done: string }>> = {
  start: { button: 'Start work', done: 'Work started' },
  resolve: { button: 'Resolve request', done: 'Request resolved' },
  reopen: { button: 'Reopen request', done: 'Request reopened' },
  close: { button: 'Close request', done: 'Request closed' },
  withdraw: { button: 'Withdraw request', done: 'Request withdrawn' },
  reject: { button: 'Reject request', done: 'Request rejected' },
}

function TransitionDialog({ request, action, onClose, onDone, onError }: Props) {
  const [note, setNote] = useState('')
  const required = noteRequired.includes(action)
  const mutation = useMutation({
    mutationFn: () => post(request.id, 'transitions', { action, note: note.trim() || null }),
    onSuccess: (updated) => {
      toast(outcome[action]!.done)
      onDone(updated)
    },
    onError,
  })

  return (
    <Form
      title={outcome[action]!.button}
      eyebrow={request.reference}
      submitLabel={outcome[action]!.button}
      onClose={onClose}
      onSubmit={mutation.mutate}
      pending={mutation.isPending}
      error={mutation.error ? errorText(mutation.error) : undefined}
      danger={action === 'withdraw' || action === 'reject'}
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
  const category = categories?.find((c) => c.id === request.category.id)
  const owner = category?.owning_department
  const confidential = !!category?.is_confidential && !!owner
  // Until the user picks one, follow the category's owning department once it has loaded.
  const [picked, setDepartment] = useState<string>()
  const department = confidential ? String(owner.id) : (picked ?? (owner ? String(owner.id) : ''))
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
    onSuccess: (updated) => {
      toast(`${action === 'assign' ? 'Assigned' : 'Reassigned'} to ${chosen?.full_name}`)
      onDone(updated)
    },
    onError,
  })

  const name = action === 'assign' ? 'Assign' : 'Reassign'
  const candidates = people.data?.filter((u) => u.id !== request.requester.id)

  return (
    <Form
      title={`${name} request`}
      eyebrow={request.reference}
      submitLabel={chosen ? `${name} to ${chosen.full_name}` : name}
      onClose={onClose}
      onSubmit={mutation.mutate}
      pending={mutation.isPending}
      disabled={!chosen || chosen.id === request.assignee?.id}
      error={mutation.error ? errorText(mutation.error) : undefined}
    >
      {confidential ? (
        <p className="text-[13px] text-muted">Confidential requests can only be handled by {owner.name}.</p>
      ) : (
        <ChipGroup
          label="Department"
          value={department}
          onChange={setDepartment}
          options={[{ value: '', label: 'Everyone' }, ...(departments ?? []).map((d) => ({ value: String(d.id), label: d.name }))]}
        />
      )}
      <SearchInput placeholder="Search by name" aria-label="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div role="radiogroup" aria-label="Assignee" className="max-h-[300px] overflow-y-auto border-t border-ink">
        {people.isPending ? (
          <p className="p-6 text-sm text-n-600">Loading people…</p>
        ) : people.isError ? (
          <p role="alert" className="p-6 text-sm text-danger">
            {people.error.message}
          </p>
        ) : !candidates || candidates.length === 0 ? (
          <p className="p-6 text-sm text-n-600">No one matches. Try another department or name.</p>
        ) : (
          candidates.map((u) => {
            const checked = chosen?.id === u.id
            const current = request.assignee?.id === u.id
            return (
              <button
                key={u.id}
                type="button"
                role="radio"
                aria-checked={checked}
                disabled={current}
                onClick={() => setChosen(u)}
                className={cn(
                  'grid min-h-14 w-full grid-cols-[36px_1fr_auto] items-center gap-3 border-b border-l-[3px] border-b-line border-l-transparent py-2 pl-[11px] pr-3.5 text-left hover:bg-[#f0f2ec] disabled:cursor-not-allowed disabled:opacity-60',
                  checked && 'border-l-accent bg-accent-soft',
                )}
              >
                <Avatar name={u.full_name} active={checked} />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2 text-[14.5px] font-semibold">
                    {u.full_name}
                    {current && (
                      <span className="shrink-0 whitespace-nowrap rounded-xs border border-control px-1.5 text-[11px] font-bold uppercase">Current</span>
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
      {people.data?.length === 50 && (
        <p className="text-[13px] text-muted">Showing the first 50 people. Search by name to find others.</p>
      )}
      <Field label="Note (optional)">
        <Textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Form>
  )
}

export const ActionDialog = (props: Props) =>
  props.action === 'assign' || props.action === 'reassign' ? <AssignDialog {...props} /> : <TransitionDialog {...props} />
