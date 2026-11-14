import { useState, type KeyboardEvent } from 'react'
import { api, ApiError } from '../../api/client'
import type { AiAnswer, ToolUse } from '../../api/types'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
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
    <div className="rounded-md border border-slate-200 p-3">
      <p className="text-sm font-medium">{toolName(tool.name)}</p>
      {filters.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {filters.map(([k, v]) => (
            <Badge key={k} tone="bg-slate-100 text-slate-700">
              {k}: {cell(v)}
            </Badge>
          ))}
        </div>
      )}
      {columns.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No rows</p>
      ) : (
        <div className="mt-2 max-h-60 overflow-auto rounded-md border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">
                    {toolName(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tool.rows.map((row, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c} className="whitespace-nowrap px-3 py-2">
                      {cell(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Turn({ item, pending, onRetry }: { item: Exchange; pending: boolean; onRetry: () => void }) {
  return (
    <div className="space-y-3">
      <p className="ml-auto w-fit max-w-[90%] whitespace-pre-wrap break-words rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">
        {item.question}
      </p>
      <Card>
        {pending ? (
          <p role="status" className="flex items-center gap-2 text-sm text-slate-600">
            <Spinner className="size-4 text-indigo-600" />
            Looking at the data...
          </p>
        ) : item.error ? (
          <>
            <p role="alert" className="text-sm text-red-600">
              {item.error}
            </p>
            <Button variant="secondary" className="mt-3" onClick={onRetry}>
              Try again
            </Button>
          </>
        ) : (
          item.answer && (
            <>
              <p className="whitespace-pre-wrap text-sm">{item.answer.answer}</p>
              {item.answer.tools_used.length > 0 && (
                <details open className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                    How this was answered
                  </summary>
                  <div className="mt-3 space-y-3">
                    {item.answer.tools_used.map((t, i) => (
                      <Tool key={i} tool={t} />
                    ))}
                  </div>
                </details>
              )}
            </>
          )
        )}
      </Card>
    </div>
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
      <PageHeader title="Assistant" subtitle="Ask a question about people, requests and onboarding." />

      {thread.length === 0 ? (
        <Card className="mb-4">
          <p className="mb-3 text-sm font-medium text-slate-700">Try one of these</p>
          <div className="flex flex-wrap gap-2">
            {examples.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {q}
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <div className="mb-4 space-y-6">
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
        className="space-y-2"
      >
        <textarea
          aria-label="Your question"
          rows={3}
          maxLength={MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask a question"
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {text.length} / {MAX}
          </span>
          <Button type="submit" disabled={!text.trim() || pendingId !== null}>
            Send
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Answers come from live platform data through a fixed set of read-only queries. Check the rows shown with each answer.
        </p>
      </form>
    </div>
  )
}
