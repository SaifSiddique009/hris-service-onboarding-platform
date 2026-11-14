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
import { RowLink, Table, Td, Th } from '../../components/Table'
import { errorText } from '../../lib/format'

export const ActiveBadge = ({ active }: { active: boolean }) => <StatusBadge status={active ? 'ACTIVE' : 'INACTIVE'} />

const taskCount = (n: number) => `${n} ${n === 1 ? 'task' : 'tasks'}`

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
  const navigate = useNavigate()
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
            <>
              <Table className="max-md:hidden">
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Description</Th>
                    <Th className="text-right">Tasks</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <RowLink key={t.id} onOpen={() => navigate(`/onboarding/templates/${t.id}`)}>
                      <Td className="font-semibold">{t.name}</Td>
                      <Td className="max-w-md text-n-600">{t.description}</Td>
                      <Td className="text-right tabular-nums">{t.task_count}</Td>
                      <Td>
                        <ActiveBadge active={t.is_active} />
                      </Td>
                    </RowLink>
                  ))}
                </tbody>
              </Table>
              <ul className="border-t border-ink md:hidden">
                {templates.map((t) => (
                  <li key={t.id}>
                    <Link
                      to={`/onboarding/templates/${t.id}`}
                      className="flex min-h-11 flex-col gap-2 border-b border-line py-4 text-ink no-underline hover:text-ink"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="text-base font-semibold">{t.name}</span>
                        <ActiveBadge active={t.is_active} />
                      </span>
                      <span className="text-[13px] text-n-600">{t.description}</span>
                      <span className="text-[13px] tabular-nums text-muted">{taskCount(t.task_count)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )
        }
      </QueryBoundary>
      {creating && <NewTemplateDialog onClose={() => setCreating(false)} />}
    </>
  )
}
