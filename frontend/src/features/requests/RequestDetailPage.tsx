import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, api } from '../../api/client'
import type { RequestAction, RequestComment, RequestDetail, UserSummary } from '../../api/types'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Textarea } from '../../components/Fields'
import { PriorityBadge, StatusBadge } from '../../components/RequestBadges'
import { Spinner } from '../../components/Spinner'
import { formatDate, formatDateTime, label, roleLabel } from '../../lib/format'
import { ActionDialog } from './ActionDialogs'

const quietActions: RequestAction[] = ['withdraw', 'reject', 'reopen']
const staleCodes = ['ALREADY_ASSIGNED', 'INVALID_TRANSITION']

const person = (u: UserSummary) => `${u.full_name} (${roleLabel(u.role)}, ${u.department.name})`

const Meta = ({ name, children }: { name: string; children: ReactNode }) => (
  <div>
    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{name}</dt>
    <dd className="mt-0.5 text-sm">{children}</dd>
  </div>
)

function CommentForm({ id }: { id: number }) {
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const add = useMutation({
    mutationFn: () => api<RequestComment>(`/requests/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
    onSuccess: () => {
      setBody('')
      return queryClient.invalidateQueries({ queryKey: ['request', String(id)] })
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    add.mutate()
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-2">
      <Textarea
        required
        rows={3}
        maxLength={4000}
        aria-label="Add a comment"
        placeholder="Write a comment"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {add.isError && (
        <p role="alert" className="text-sm text-red-600">
          {add.error.message}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" loading={add.isPending} disabled={!body.trim()}>
          Add comment
        </Button>
      </div>
    </form>
  )
}

export function RequestDetailPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const [action, setAction] = useState<RequestAction | null>(null)
  const [notice, setNotice] = useState('')

  const key = ['request', id]
  const { data, isPending, error, refetch } = useQuery({
    queryKey: key,
    queryFn: () => api<RequestDetail>(`/requests/${id}`),
    retry: (count, err) => !(err instanceof ApiError && err.status < 500 && err.status !== 0) && count < 2,
  })

  function onDone(updated: RequestDetail) {
    queryClient.setQueryData(key, updated)
    queryClient.invalidateQueries({ queryKey: ['requests'] })
    setAction(null)
    setNotice('')
  }

  function onError(err: Error) {
    setAction(null)
    setNotice(err.message)
    if (err instanceof ApiError && staleCodes.includes(err.code)) refetch()
  }

  if (isPending)
    return (
      <div className="flex justify-center py-16 text-indigo-600">
        <Spinner />
      </div>
    )

  if (error instanceof ApiError && error.status === 404)
    return (
      <Card className="mx-auto max-w-md text-center">
        <h1 className="text-lg font-semibold">Request not found</h1>
        <p className="mt-1 text-sm text-slate-500">It may not exist, or you may not have access to it.</p>
        <Link to="/requests" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
          Back to requests
        </Link>
      </Card>
    )

  if (error)
    return (
      <Card className="mx-auto max-w-md">
        <p role="alert" className="text-sm text-red-600">
          {error.message}
        </p>
        <Button variant="secondary" className="mt-3" onClick={() => refetch()}>
          Try again
        </Button>
      </Card>
    )

  const buttons = data.allowed_actions.filter((a) => a !== 'comment')

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/requests" className="text-sm font-medium text-indigo-600 hover:underline">
        Back to requests
      </Link>

      <Card>
        <p className="font-mono text-xs text-slate-500">{data.reference}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{data.title}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge status={data.status} />
          <PriorityBadge priority={data.priority} />
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <Meta name="Category">{data.category.name}</Meta>
          <Meta name="Created">{formatDate(data.created_at)}</Meta>
          <Meta name="Requester">{person(data.requester)}</Meta>
          <Meta name="Assignee">{data.assignee ? person(data.assignee) : 'Unassigned'}</Meta>
          {data.closure_reason && <Meta name="Closure reason">{label(data.closure_reason)}</Meta>}
        </dl>
        <h2 className="mb-1 mt-6 text-sm font-semibold">Description</h2>
        <p className="whitespace-pre-wrap text-sm text-slate-700">{data.description}</p>

        {notice && (
          <p role="alert" className="mt-5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {notice}
          </p>
        )}
        {buttons.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
            {buttons.map((a) => (
              <Button key={a} variant={quietActions.includes(a) ? 'secondary' : 'primary'} onClick={() => setAction(a)}>
                {label(a)}
              </Button>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Comments</h2>
        {data.comments.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No comments yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {data.comments.map((c) => (
              <li key={c.id} className="py-3">
                <p className="text-sm">
                  <span className="font-medium">{c.author.full_name}</span>{' '}
                  <span className="text-slate-500">
                    {roleLabel(c.author.role)}, {c.author.department.name} · {formatDateTime(c.created_at)}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
        {data.allowed_actions.includes('comment') && <CommentForm id={data.id} />}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">History</h2>
        <ol className="mt-3 space-y-4 border-l border-slate-200 pl-4">
          {data.history.map((e, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-indigo-500" />
              <p className="text-sm font-medium">
                {e.from_status ? `${label(e.from_status)} to ${label(e.to_status)}` : `Created as ${label(e.to_status)}`}
              </p>
              <p className="text-xs text-slate-500">
                {e.actor.full_name} · {formatDateTime(e.created_at)}
              </p>
              {e.note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{e.note}</p>}
            </li>
          ))}
        </ol>
      </Card>

      {action && (
        <ActionDialog request={data} action={action} onClose={() => setAction(null)} onDone={onDone} onError={onError} />
      )}
    </div>
  )
}
