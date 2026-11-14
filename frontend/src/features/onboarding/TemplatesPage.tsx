import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import type { Template, TemplateDetail } from '../../api/types'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Field, Input, Textarea } from '../../components/Fields'
import { FormDialog } from '../../components/FormDialog'
import { PageHeader } from '../../components/PageHeader'
import { QueryBoundary } from '../../components/QueryBoundary'
import { errorText } from '../../lib/format'

export const ActiveBadge = ({ active }: { active: boolean }) => (
  <Badge tone={active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-700'}>{active ? 'Active' : 'Inactive'}</Badge>
)

function NewTemplateDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const create = useMutation({
    mutationFn: () =>
      api<TemplateDetail>('/onboarding/templates', { method: 'POST', body: JSON.stringify({ name: name.trim(), description: description.trim() }) }),
    onSuccess: (t) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding', 'templates'] })
      navigate(`/onboarding/templates/${t.id}`)
    },
  })

  return (
    <FormDialog
      title="New template"
      submitLabel="Create"
      onClose={onClose}
      pending={create.isPending}
      error={create.error ? errorText(create.error) : undefined}
      onSubmit={create.mutate}
    >
      <Field label="Name">
        <Input required minLength={3} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Description">
        <Textarea required minLength={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
    </FormDialog>
  )
}

export function TemplatesPage() {
  const [creating, setCreating] = useState(false)
  const list = useQuery({ queryKey: ['onboarding', 'templates'], queryFn: () => api<Template[]>('/onboarding/templates') })

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Templates" subtitle="Task lists that become a checklist when a new hire is assigned." />
        <Button className="shrink-0" onClick={() => setCreating(true)}>
          New template
        </Button>
      </div>
      <QueryBoundary query={list}>
        {(templates) =>
          templates.length === 0 ? (
            <Card className="py-12 text-center text-sm text-slate-500">No templates yet.</Card>
          ) : (
            <ul className="space-y-3">
              {templates.map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/onboarding/templates/${t.id}`}
                    className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-semibold">{t.name}</h2>
                      <ActiveBadge active={t.is_active} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{t.description}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {t.task_count} {t.task_count === 1 ? 'task' : 'tasks'}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      </QueryBoundary>
      {creating && <NewTemplateDialog onClose={() => setCreating(false)} />}
    </div>
  )
}
