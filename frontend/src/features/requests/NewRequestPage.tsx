import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, api } from '../../api/client'
import type { RequestDetail, RequestPriority } from '../../api/types'
import { Button } from '../../components/Button'
import { Field, Input, Textarea } from '../../components/Fields'
import { PageHeader } from '../../components/PageHeader'
import { LoadingState } from '../../components/States'
import { cn } from '../../lib/cn'
import { label, priorities } from '../../lib/format'
import { useOnce } from '../../lib/once'
import { toast } from '../../lib/toast'
import { useCategories } from './queries'

const choice =
  'relative flex cursor-pointer rounded-sm border border-control bg-paper hover:border-n-400 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus'
const heights = ['h-[5px]', 'h-2', 'h-[11px]']
const filled = { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 3 }

function PriorityBars({ priority }: { priority: RequestPriority }) {
  const colour = priority === 'URGENT' ? 'bg-danger' : priority === 'HIGH' ? 'bg-amber' : 'bg-ink'
  return (
    <span aria-hidden className="relative flex items-end gap-0.5">
      {heights.map((height, bar) => (
        <span key={height} className={cn('w-[3px] rounded-[1px]', height, bar < filled[priority] ? colour : 'bg-n-300')} />
      ))}
    </span>
  )
}

export function NewRequestPage() {
  const navigate = useNavigate()
  const once = useOnce()
  const queryClient = useQueryClient()
  const categories = useCategories()
  const [categoryId, setCategoryId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<RequestPriority>('MEDIUM')

  const category = categories.data?.find((c) => String(c.id) === categoryId)

  const create = useMutation({
    mutationFn: () =>
      api<RequestDetail>('/requests', {
        method: 'POST',
        body: JSON.stringify({ category_id: Number(categoryId), title: title.trim(), description: description.trim(), priority }),
      }),
    onSuccess: (request) => {
      queryClient.setQueryData(['request', String(request.id)], request)
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      toast('Request created')
      navigate(`/requests/${request.id}`)
    },
  })

  const error = create.error
  const fields = error instanceof ApiError ? error.fields : {}

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!create.isPending) once(() => create.mutate())
  }

  return (
    <div>
      <PageHeader eyebrow="New request" title="What do you need?" back={{ to: '/requests', label: 'Requests' }} />
      <form onSubmit={onSubmit} className="flex max-w-[680px] flex-col gap-8">
        <fieldset>
          <legend className="mb-2.5 text-sm font-semibold">Category</legend>
          {categories.isPending ? (
            <LoadingState />
          ) : (
            <div role="radiogroup" aria-label="Category" className="flex flex-col gap-1.5">
              {categories.data?.map((c) => (
                <label key={c.id} className={cn(choice, 'grid grid-cols-[18px_minmax(0,1fr)] gap-3 px-3.5 py-3 has-checked:border-accent has-checked:bg-accent-soft')}>
                  <input
                    type="radio"
                    name="category"
                    className="peer sr-only"
                    checked={String(c.id) === categoryId}
                    onChange={() => setCategoryId(String(c.id))}
                  />
                  <span aria-hidden className="mt-px size-[18px] rounded-full border-[1.5px] border-n-400 bg-paper peer-checked:border-[5.5px] peer-checked:border-accent" />
                  <span>
                    <span className="flex items-center gap-2 text-[14.5px] font-semibold text-ink">
                      {c.name}
                      {c.is_confidential && <Lock aria-label="Confidential" size={14} strokeWidth={1.8} className="text-muted" />}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-muted">{c.description}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          {fields.category_id && (
            <p role="alert" className="mt-1.5 text-[13px] font-medium text-danger">
              {fields.category_id}
            </p>
          )}
          {category?.is_confidential && (
            <div className="mt-2.5 flex gap-2.5 rounded-sm bg-plum-soft px-3.5 py-3 text-[13.5px] leading-normal text-[#4a3d61]">
              <Lock aria-hidden size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
              <span>Only you, the person HR assigns, and HR can see this request.</span>
            </div>
          )}
        </fieldset>
        <Field label="Title" error={fields.title}>
          <Input
            required
            maxLength={200}
            placeholder="A short summary, e.g. “Laptop will not power on”"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="Description" error={fields.description}>
          <Textarea
            required
            rows={5}
            maxLength={4000}
            placeholder="What happened, since when, and anything you have already tried."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <fieldset>
          <legend className="mb-2.5 text-sm font-semibold">Priority</legend>
          <div role="radiogroup" aria-label="Priority" className="flex pl-px">
            {priorities.map((p) => (
              <label key={p} className={cn(choice, '-ml-px min-h-10 flex-1 basis-0 items-center justify-center gap-2 text-[13.5px] font-medium max-md:min-h-11')}>
                <input
                  type="radio"
                  name="priority"
                  className="peer sr-only"
                  checked={p === priority}
                  onChange={() => setPriority(p)}
                />
                <span className="pointer-events-none absolute inset-0 border border-transparent peer-checked:z-10 peer-checked:border-ink" />
                <PriorityBars priority={p} />
                <span className="relative peer-checked:font-semibold">{label(p)}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-muted">Use Urgent only when work has stopped.</p>
          {fields.priority && (
            <p role="alert" className="mt-1.5 text-[13px] font-medium text-danger">
              {fields.priority}
            </p>
          )}
        </fieldset>
        {error && !Object.keys(fields).length && (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {error.message}
          </p>
        )}
        <div className="flex gap-2 border-t border-line pt-2">
          <Button type="submit" loading={create.isPending} disabled={!categoryId}>
            Submit request
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/requests')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
