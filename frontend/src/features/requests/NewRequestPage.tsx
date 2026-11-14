import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, api } from '../../api/client'
import type { RequestDetail, RequestPriority } from '../../api/types'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Field, Input, Select, Textarea } from '../../components/Fields'
import { PageHeader } from '../../components/PageHeader'
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
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New request" />
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field
            label="Category"
            error={fields.category_id}
            hint={
              category && (
                <>
                  {category.description}
                  {category.is_confidential && (
                    <span className="mt-1 block text-slate-700">
                      Only you, the person HR assigns, and HR can see this request.
                    </span>
                  )}
                </>
              )
            }
          >
            <Select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Select a category</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title" error={fields.title}>
            <Input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Description" error={fields.description}>
            <Textarea required rows={6} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Priority" error={fields.priority}>
            <Select value={priority} onChange={(e) => setPriority(e.target.value as RequestPriority)}>
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {label(p)}
                </option>
              ))}
            </Select>
          </Field>
          {error && !Object.keys(fields).length && (
            <p role="alert" className="text-sm text-red-600">
              {error.message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate('/requests')}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Submit request
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
