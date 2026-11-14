import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, api } from '../../api/client'
import type { RequestAction, RequestComment, RequestDetail, StatusEvent, UserSummary } from '../../api/types'
import { Button } from '../../components/Button'
import { ChipGroup } from '../../components/ChipGroup'
import { Avatar } from '../../components/Avatar'
import { Textarea } from '../../components/Fields'
import { eyebrowClass } from '../../components/PageHeader'
import { PriorityBadge, StatusBadge } from '../../components/RequestBadges'
import { EmptyState, ErrorState, LoadingState } from '../../components/States'
import { formatDate, formatDateTime, label, roleLabel, timeAgo } from '../../lib/format'
import { useOnce } from '../../lib/once'
import { toast } from '../../lib/toast'
import { ActionDialog } from './ActionDialogs'
import { statusText } from './status'

const actionVariants: Partial<Record<RequestAction, 'secondary' | 'danger'>> = {
  reassign: 'secondary',
  reopen: 'secondary',
  reject: 'danger',
  withdraw: 'danger',
}
const staleCodes = ['ALREADY_ASSIGNED', 'INVALID_TRANSITION']

const sectionHeading = 'border-t border-ink pt-4 font-serif text-[28px] leading-[1.2]'

function historyLine(e: StatusEvent, previous: UserSummary | undefined, closure: RequestDetail['closure_reason'], last: boolean) {
  const by = e.actor.full_name
  if (!e.from_status) return `Submitted by ${by}`
  if (e.to_status === 'ASSIGNED' && e.assignee)
    return previous
      ? `Reassigned from ${previous.full_name} to ${e.assignee.full_name} by ${by}`
      : `Assigned to ${e.assignee.full_name} by ${by}`
  if (e.to_status === 'IN_PROGRESS') return e.from_status === 'RESOLVED' ? `Reopened by ${by}` : `Work started by ${by}`
  if (e.to_status === 'RESOLVED') return `Resolved by ${by}`
  if (e.to_status === 'CLOSED') {
    if (last && closure === 'WITHDRAWN') return `Withdrawn by ${by}`
    if (last && closure === 'REJECTED') return `Rejected by ${by}`
    return `Closed by ${by}`
  }
  return `${label(e.from_status)} to ${label(e.to_status)} by ${by}`
}

type ActivityItem =
  | { kind: 'event'; key: string; at: string; line: string; note: string | null }
  | { kind: 'comment'; key: string; at: string; comment: RequestComment }

const When = ({ iso }: { iso: string }) => (
  <time dateTime={iso} title={formatDateTime(iso)} className="whitespace-nowrap">
    {timeAgo(iso)}
  </time>
)

const Row = ({ name, children }: { name: string; children: ReactNode }) => (
  <div className="flex justify-between gap-3 border-b border-line py-3 text-sm">
    <dt className="text-muted">{name}</dt>
    <dd className="min-w-0 text-right">{children}</dd>
  </div>
)

const PersonRow = ({ name, user }: { name: string; user: UserSummary | null }) => (
  <div className="border-b border-line py-3.5">
    <dt className="mb-2 text-[12.5px] text-muted">{name}</dt>
    <dd className="flex items-center gap-2.5 text-sm">
      {user ? (
        <>
          <Avatar name={user.full_name} />
          <span className="min-w-0">
            <strong className="block font-semibold">{user.full_name}</strong>
            <span className="block text-[13px] text-muted">
              {roleLabel(user.role)} · {user.department.name}
            </span>
          </span>
        </>
      ) : (
        <span className="italic text-muted">Unassigned</span>
      )}
    </dd>
  </div>
)

function CommentForm({ id, onAdded }: { id: number; onAdded: () => void }) {
  const queryClient = useQueryClient()
  const once = useOnce()
  const [body, setBody] = useState('')
  const add = useMutation({
    mutationFn: () => api<RequestComment>(`/requests/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
    onSuccess: () => {
      setBody('')
      onAdded()
      toast('Comment added')
      return queryClient.invalidateQueries({ queryKey: ['request', String(id)] })
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!add.isPending) once(() => add.mutate())
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
  const [filter, setFilter] = useState('all')

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
  }

  function onError(err: Error) {
    if (err instanceof ApiError && staleCodes.includes(err.code)) refetch()
  }

  if (isPending) return <LoadingState />

  if (error instanceof ApiError && (error.status === 404 || error.status === 422))
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

  if (error instanceof ApiError && error.status === 0) return <ErrorState message={error.message} onRetry={() => refetch()} />

  if (error)
    return (
      <EmptyState
        title="Something went wrong"
        help={error.message}
        action={
          <Button variant="secondary" onClick={() => refetch()}>
            Try again
          </Button>
        }
      />
    )

  const buttons = data.allowed_actions.filter((a) => a !== 'comment')
  const activity: ActivityItem[] = [
    ...data.history.map((e, i): ActivityItem => {
      const previous = data.history.slice(0, i).reverse().find((h) => h.assignee)?.assignee ?? undefined
      const lastClosed = !data.history.slice(i + 1).some((h) => h.to_status === 'CLOSED')
      return { kind: 'event', key: `e${i}`, at: e.created_at, line: historyLine(e, previous, data.closure_reason, lastClosed), note: e.note }
    }),
    ...data.comments.map((c): ActivityItem => ({ kind: 'comment', key: `c${c.id}`, at: c.created_at, comment: c })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  const shown = activity.filter((i) => filter === 'all' || (filter === 'comments' ? i.kind === 'comment' : i.kind === 'event'))

  return (
    <div>
      <div className="mb-7">
        <Link
          to="/requests"
          className="-ml-2.5 mb-4 inline-flex min-h-9 items-center gap-2 rounded-sm px-2.5 text-sm font-medium text-ink no-underline hover:bg-n-100 hover:text-ink"
        >
          <ArrowLeft aria-hidden size={16} strokeWidth={1.8} />
          Requests
        </Link>
        <div className="min-w-0">
          <p className={eyebrowClass}>{data.reference}</p>
          <h1 title={data.title} className="line-clamp-2 pb-1 text-balance font-serif text-[46px] font-normal leading-[1.05] tracking-[-0.02em] max-md:text-[32px]">
            {data.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <StatusBadge status={data.status}>{statusText(data)}</StatusBadge>
            <PriorityBadge priority={data.priority} />
            <span className="whitespace-nowrap text-[13.5px] text-muted">Created {formatDate(data.created_at)}</span>
          </div>
        </div>
        {buttons.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {buttons.map((a) => (
              <Button key={a} variant={actionVariants[a] ?? 'primary'} onClick={() => setAction(a)}>
                {label(a)}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <aside className="border-t border-ink pt-4 max-lg:order-first">
          <h2 className="mb-1 text-[11.5px] font-semibold uppercase tracking-[.08em] text-muted">Details</h2>
          <dl>
            <PersonRow name="Requester" user={data.requester} />
            <PersonRow name="Assignee" user={data.assignee} />
            <Row name="Category">{data.category.name}</Row>
            <Row name="Priority">
              <PriorityBadge priority={data.priority} />
            </Row>
            <Row name="Created">
              <span className="tabular-nums">{formatDate(data.created_at)}</span>
            </Row>
            <Row name="Comments">
              <span className="tabular-nums">{data.comments.length}</span>
            </Row>
            {data.closure_reason && <Row name="Closure reason">{label(data.closure_reason)}</Row>}
          </dl>
        </aside>

        <div className="min-w-0 space-y-14 lg:row-start-1">
          <section>
            <h2 className={sectionHeading}>Description</h2>
            <p className="mt-3 whitespace-pre-wrap text-[14.5px] leading-[1.55]">{data.description}</p>
          </section>

          <section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink pt-4">
              <h2 className="font-serif text-[28px] leading-[1.2]">Activity</h2>
              <ChipGroup
                label="Filter activity"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: `All ${activity.length}` },
                  { value: 'comments', label: `Comments ${data.comments.length}` },
                  { value: 'history', label: `History ${data.history.length}` },
                ]}
              />
            </div>
            {shown.length === 0 && <p className="text-sm text-muted">No {filter === 'comments' ? 'comments' : 'history'} yet.</p>}
            <ol>
              {shown.map((item) => (
                <li key={item.key} className="group relative grid grid-cols-[36px_minmax(0,1fr)] gap-3.5 pb-5 last:pb-0">
                  <span aria-hidden className="absolute bottom-0 left-[17.5px] top-9 w-px bg-line group-last:hidden" />
                  {item.kind === 'event' ? (
                    <>
                      <span aria-hidden className="relative grid size-9 place-items-center">
                        <span className="size-2.5 rounded-full border-2 border-ink bg-paper" />
                      </span>
                      <div className="min-w-0 pt-1.5 text-[13px]">
                        <p className="text-sm font-semibold">{item.line}</p>
                        {item.note && <p className="mt-1 whitespace-pre-wrap text-[13.5px]">{item.note}</p>}
                        <p className="mt-1 text-muted">
                          <When iso={item.at} />
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Avatar name={item.comment.author.full_name} />
                      <div className="min-w-0 rounded-sm border border-line bg-paper px-4 py-3">
                        <p className="flex flex-wrap items-baseline gap-x-2 text-[13px] text-muted">
                          <span className="text-sm font-semibold text-ink">{item.comment.author.full_name}</span>
                          <span>
                            {roleLabel(item.comment.author.role)} · {item.comment.author.department.name}
                          </span>
                          <When iso={item.at} />
                        </p>
                        <p className="mt-1.5 whitespace-pre-wrap text-[14.5px] leading-[1.55]">{item.comment.body}</p>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ol>
            {data.allowed_actions.includes('comment') && <CommentForm id={data.id} onAdded={() => setFilter((f) => (f === 'history' ? 'all' : f))} />}
          </section>
        </div>
      </div>

      {action && (
        <ActionDialog request={data} action={action} onClose={() => setAction(null)} onDone={onDone} onError={onError} />
      )}
    </div>
  )
}
