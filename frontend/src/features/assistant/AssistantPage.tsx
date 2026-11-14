import { useState, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { api, ApiError } from '../../api/client'
import type { AiAnswer, ToolUse } from '../../api/types'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Textarea } from '../../components/Fields'
import { PageHeader, eyebrowClass } from '../../components/PageHeader'
import { Table, Td, Th } from '../../components/Table'
import { Spinner } from '../../components/Spinner'

const MAX = 500
const examples = [
  'How many IT Equipment requests are unresolved in Cyprus?',
  'Which new hires have overdue onboarding tasks?',
  'How is onboarding going in Malaysia?',
  'Which new hires are still waiting on IT equipment?',
  'How many people are on probation, by department?',
]

interface Exchange {
  id: number
  question: string
  answer?: AiAnswer
  error?: string
}

const toolName = (name: string) => {
  const text = name.replaceAll('_', ' ')
  return text[0].toUpperCase() + text.slice(1)
}

const cell = (v: unknown) => (v == null ? '-' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : typeof v === 'object' ? JSON.stringify(v) : String(v))

const failure = (err: unknown) =>
  err instanceof ApiError && err.status === 404
    ? 'The assistant is not available yet. Please try again later.'
    : err instanceof Error
      ? err.message
      : 'Something went wrong'

function Tool({ tool }: { tool: ToolUse }) {
  const filters = Object.entries(tool.arguments).filter(([, v]) => v != null)
  const columns = Object.keys(tool.rows[0] ?? {})
  return (
    <div className="border-t border-line py-3 first:border-t-0 first:pt-0">
      <p className="font-mono text-[12.5px] leading-relaxed">{tool.name}</p>
      {filters.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {filters.map(([k, v]) => (
            <Badge key={k}>
              {k}: {cell(v)}
            </Badge>
          ))}
        </div>
      )}
      {columns.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted">No rows</p>
      ) : (
        <div className="mt-3 max-h-60 overflow-auto">
          <Table>
            <thead>
              <tr>
                {columns.map((c) => (
                  <Th key={c} className="whitespace-nowrap">
                    {toolName(c)}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tool.rows.map((row, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <Td key={c} className="whitespace-nowrap py-2 text-[13px]">
                      {cell(row[c])}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  )
}

function Turn({ item, pending, onRetry }: { item: Exchange; pending: boolean; onRetry: () => void }) {
  return (
    <section className="border-t border-ink pt-4">
      <h3 className="whitespace-pre-wrap break-words font-serif text-[21px] leading-snug">{item.question}</h3>
      <div className="mt-3">
        {pending ? (
          <p role="status" className="flex items-center gap-2.5 text-sm text-muted">
            <Spinner />
            Looking at the data…
          </p>
        ) : item.error ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
            <p>{item.error}</p>
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : (
          item.answer && (
            <>
              <p className="whitespace-pre-wrap text-[14.5px] leading-[1.55]">{item.answer.answer}</p>
              {item.answer.tools_used.length > 0 && (
                <Card variant="boxed" className="mt-4">
                  <p className={`${eyebrowClass} mb-3`}>How this was answered</p>
                  {item.answer.tools_used.map((t, i) => (
                    <Tool key={i} tool={t} />
                  ))}
                </Card>
              )}
            </>
          )
        )}
      </div>
    </section>
  )
}

export function AssistantPage() {
  const [thread, setThread] = useState<Exchange[]>([])
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [text, setText] = useState('')

  async function ask(id: number, question: string) {
    setPendingId(id)
    const patch = await api<AiAnswer>('/ai/query', { method: 'POST', body: JSON.stringify({ question }) }).then(
      (answer) => ({ answer, error: undefined }),
      (err) => ({ answer: undefined, error: failure(err) }),
    )
    setThread((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    setPendingId(null)
  }

  function send(question: string) {
    const q = question.trim()
    if (!q || pendingId !== null) return
    const id = Date.now()
    setThread((t) => [...t, { id, question: q }])
    setText('')
    ask(id, q)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(text)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Assistant" title="Ask about your people data" subtitle="Ask a question about people, requests and onboarding." />

      {thread.length === 0 ? (
        <section className="mb-10 border-t border-ink pt-4">
          <h2 className="font-serif text-[21px] leading-snug">Try one of these</h2>
          <ul className="mt-3 flex flex-col items-start gap-2">
            {examples.map((q) => (
              <li key={q}>
                <Button variant="secondary" className="h-auto py-2 text-left font-medium whitespace-normal!" onClick={() => send(q)}>
                  {q}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="mb-10 flex flex-col gap-10">
          {thread.map((item) => (
            <Turn key={item.id} item={item} pending={item.id === pendingId} onRetry={() => ask(item.id, item.question)} />
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(text)
        }}
        className="flex flex-col gap-2"
      >
        <Textarea
          aria-label="Your question"
          rows={3}
          maxLength={MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask a question"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] tabular-nums text-muted">
            {text.length} / {MAX}
          </span>
          <Button type="submit" disabled={!text.trim() || pendingId !== null}>
            <Send aria-hidden size={16} strokeWidth={1.8} />
            Send
          </Button>
        </div>
        <p className="text-[13px] text-muted">
          Answers come from live platform data through a fixed set of read-only queries. Check the rows shown with each answer.
        </p>
      </form>
    </div>
  )
}
