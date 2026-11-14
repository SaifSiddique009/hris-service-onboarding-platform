import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import type { Template, TemplateDetail } from '../../api/types'
import { Button } from '../../components/Button'
import { Field, Input, Textarea } from '../../components/Fields'
import { FormDialog } from '../../components/FormDialog'
import { PageHeader } from '../../components/PageHeader'
import { QueryBoundary } from '../../components/QueryBoundary'
import { StatusBadge } from '../../components/RequestBadges'
import { EmptyState } from '../../components/States'
import { errorText, formatDate, plural } from '../../lib/format'
import { toast } from '../../lib/toast'

export const ActiveBadge = ({ active }: { active: boolean }) => <StatusBadge status={active ? 'ACTIVE' : 'INACTIVE'} />

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
      toast('Template created')
      navigate(`/onboarding/templates/${t.id}`)
    },
  })

  return (
    <FormDialog
      title="New template"
      eyebrow="Onboarding"
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
  const newButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus aria-hidden size={16} strokeWidth={1.8} />
      New template
    </Button>
  )

  return (
    <>
      <PageHeader
        title="Templates"
        eyebrow="Onboarding"
        subtitle="Task lists that become a checklist when a new hire is assigned."
        actions={newButton}
      />
      <QueryBoundary query={list}>
        {(templates) =>
          templates.length === 0 ? (
            <EmptyState title="No templates yet" help="A template is the task list a new hire receives." action={newButton} />
          ) : (
            <ul className="border-t border-ink">
              {templates.map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/onboarding/templates/${t.id}`}
                    className="flex min-h-[72px] flex-wrap items-center gap-x-8 gap-y-1.5 border-b border-line py-4 text-ink no-underline hover:bg-n-100 hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                  >
                    <span className="min-w-0 flex-[1_1_320px]">
                      <span className="block font-serif text-xl">{t.name}</span>
                      <span className="mt-0.5 block text-[13.5px] text-muted">{t.description}</span>
                    </span>
                    <span className="text-[13px] tabular-nums text-n-600">
                      {plural(t.task_count, 'task')} · Updated {formatDate(t.updated_at)}
                    </span>
                    <ActiveBadge active={t.is_active} />
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      </QueryBoundary>
      {creating && <NewTemplateDialog onClose={() => setCreating(false)} />}
    </>
  )
}
