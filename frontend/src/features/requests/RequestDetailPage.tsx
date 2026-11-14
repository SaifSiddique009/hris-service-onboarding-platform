import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, api } from '../../api/client'
import type { RequestAction, RequestComment, RequestDetail, UserSummary } from '../../api/types'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Textarea } from '../../components/Fields'
import { PageHeader } from '../../components/PageHeader'
import { PriorityBadge, StatusBadge } from '../../components/RequestBadges'
import { EmptyState, ErrorState, LoadingState } from '../../components/States'
import { formatDate, formatDateTime, label, roleLabel } from '../../lib/format'
import { ActionDialog } from './ActionDialogs'

const actionVariants: Partial<Record<RequestAction, 'secondary' | 'danger'>> = {
  reassign: 'secondary',
  reopen: 'secondary',
  reject: 'danger',
  withdraw: 'danger',
}
const staleCodes = ['ALREADY_ASSIGNED', 'INVALID_TRANSITION']

const person = (u: UserSummary) => `${u.full_name} (${roleLabel(u.role)}, ${u.department.name})`
const sectionHeading = 'border-t border-ink pt-4 font-serif text-[28px] leading-[1.2]'

const Meta = ({ name, children }: { name: string; children: ReactNode }) => (
  <div>
    <dt className="text-[13px] text-muted">{name}</dt>
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
    <form onSubmit={submit} className="mt-5 space-y-3">
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
        <p role="alert" className="text-[13px] font-medium text-danger">
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

  if (isPending) return <LoadingState />

  if (error instanceof ApiError && error.status === 404)
    return (
      <EmptyState
        title="Request not found"
        help="It may not exist, or you may not have access to it."
        action={
          <Link to="/requests" className="text-sm font-semibold">
            Back to requests
          </Link>
        }
      />
    )

  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />

  const buttons = data.allowed_actions.filter((a) => a !== 'comment')

  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow={data.reference} title={data.title} back={{ to: '/requests', label: 'Requests' }} />

      <dl className="grid grid-cols-1 gap-x-7 gap-y-4 border-t border-ink pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <Meta name="Status">
          <StatusBadge status={data.status} />
        </Meta>
        <Meta name="Priority">
          <PriorityBadge priority={data.priority} />
        </Meta>
        <Meta name="Category">{data.category.name}</Meta>
        <Meta name="Requester">{person(data.requester)}</Meta>
        <Meta name="Assignee">{data.assignee ? person(data.assignee) : <span className="italic text-muted">Unassigned</span>}</Meta>
        <Meta name="Created">
          <span className="tabular-nums">{formatDate(data.created_at)}</span>
        </Meta>
        {data.closure_reason && <Meta name="Closure reason">{label(data.closure_reason)}</Meta>}
      </dl>

      {notice && (
        <p role="alert" className="mt-6 rounded-sm border border-danger bg-danger-wash px-3 py-2 text-[13px] font-medium text-danger">
          {notice}
        </p>
      )}
      {buttons.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {buttons.map((a) => (
            <Button key={a} variant={actionVariants[a] ?? 'primary'} onClick={() => setAction(a)}>
              {label(a)}
            </Button>
          ))}
        </div>
      )}

      <section className="mt-14">
        <h2 className={sectionHeading}>Description</h2>
        <p className="mt-3 whitespace-pre-wrap text-[14.5px] leading-[1.55]">{data.description}</p>
      </section>

      <section className="mt-14">
        <h2 className={sectionHeading}>Comments</h2>
        {data.comments.length === 0 ? (
          <p className="mt-3 text-[14.5px] text-muted">No comments yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.comments.map((c) => (
              <li key={c.id}>
                <Card variant="boxed">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-[13px] text-muted">
                    <span className="text-sm font-semibold text-ink">{c.author.full_name}</span>
                    <span>
                      {roleLabel(c.author.role)} · {c.author.department.name}
                    </span>
                    <span className="tabular-nums">{formatDateTime(c.created_at)}</span>
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-[14.5px] leading-[1.55]">{c.body}</p>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {data.allowed_actions.includes('comment') && <CommentForm id={data.id} />}
      </section>

      <section className="mt-14">
        <h2 className={sectionHeading}>History</h2>
        <ol className="mt-4 space-y-4 border-l border-control pl-3.5 text-[13px]">
          {data.history.map((e, i) => (
            <li key={i}>
              <p className="text-sm font-semibold">
                {e.from_status ? `${label(e.from_status)} to ${label(e.to_status)}` : `Created as ${label(e.to_status)}`}
              </p>
              <p className="text-muted">
                {e.actor.full_name} · <span className="tabular-nums">{formatDateTime(e.created_at)}</span>
              </p>
              {e.note && <p className="mt-1 whitespace-pre-wrap text-[13.5px]">{e.note}</p>}
            </li>
          ))}
        </ol>
      </section>

      {action && (
        <ActionDialog request={data} action={action} onClose={() => setAction(null)} onDone={onDone} onError={onError} />
      )}
    </div>
  )
}
