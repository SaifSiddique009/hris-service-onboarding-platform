import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, api } from '../../api/client'
import type { RequestDetail, RequestPriority } from '../../api/types'
import { Button } from '../../components/Button'
import { ChipGroup } from '../../components/ChipGroup'
import { Field, Input, Textarea } from '../../components/Fields'
import { PageHeader } from '../../components/PageHeader'
import { LoadingState } from '../../components/States'
import { cn } from '../../lib/cn'
import { label, priorities } from '../../lib/format'
import { useCategories } from './queries'

export function NewRequestPage() {
  const navigate = useNavigate()
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
        body: JSON.stringify({ category_id: Number(categoryId), title, description, priority }),
      }),
    onSuccess: (request) => {
      queryClient.setQueryData(['request', String(request.id)], request)
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      navigate(`/requests/${request.id}`)
    },
  })

  const error = create.error
  const fields = error instanceof ApiError ? error.fields : {}

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    create.mutate()
  }

  return (
    <div className="max-w-[640px]">
      <PageHeader eyebrow="Service requests" title="New request" back={{ to: '/requests', label: 'Requests' }} />
      <form onSubmit={onSubmit} className="flex flex-col gap-6 border-t border-ink pt-6">
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold">Category</legend>
          {categories.isPending ? (
            <LoadingState />
          ) : (
            <div role="radiogroup" aria-label="Category" className="border-t border-ink">
              {categories.data?.map((c) => {
                const checked = c.id === category?.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => setCategoryId(String(c.id))}
                    className={cn(
                      'grid min-h-14 w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-l-[3px] border-b-line border-l-transparent py-2 pl-[11px] pr-3.5 text-left hover:bg-[#f0f2ec]',
                      checked && 'border-l-accent bg-accent-soft',
                    )}
                  >
                    <span>
                      <span className="flex items-center gap-2 text-[14.5px] font-semibold">
                        {c.name}
                        {c.is_confidential && <Lock aria-label="Confidential" size={14} strokeWidth={1.8} className="text-muted" />}
                      </span>
                      <span className="block text-[12.5px] text-muted">{c.description}</span>
                    </span>
                    {checked && <Check aria-hidden size={16} strokeWidth={1.8} className="text-accent" />}
                  </button>
                )
              })}
            </div>
          )}
          {fields.category_id && (
            <p role="alert" className="mt-1.5 text-[13px] font-medium text-danger">
              {fields.category_id}
            </p>
          )}
          {category?.is_confidential && (
            <p className="mt-2 flex items-center gap-2 text-[13px] text-n-600">
              <Lock aria-hidden size={14} strokeWidth={1.8} />
              Only you, the person HR assigns, and HR can see this request.
            </p>
          )}
        </fieldset>
        <Field label="Title" error={fields.title}>
          <Input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Description" error={fields.description}>
          <Textarea required rows={6} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold">Priority</p>
          <ChipGroup
            segmented
            label="Priority"
            value={priority}
            onChange={(value) => setPriority(value as RequestPriority)}
            options={priorities.map((p) => ({ value: p, label: label(p) }))}
          />
          {fields.priority && (
            <p role="alert" className="mt-1.5 text-[13px] font-medium text-danger">
              {fields.priority}
            </p>
          )}
        </div>
        {error && !Object.keys(fields).length && (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {error.message}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/requests')}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending} disabled={!categoryId}>
            Submit request
          </Button>
        </div>
      </form>
    </div>
  )
}
