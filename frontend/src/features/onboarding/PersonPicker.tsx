import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import type { UserSummary } from '../../api/types'
import { Field, Input } from '../../components/Fields'

interface Props<T> {
  scope: unknown[]
  fetchPeople: (search: string) => Promise<T[]>
  selectedId?: number
  onPick: (person: T) => void
  detail: (person: T) => string
}

export function PersonPicker<T extends UserSummary>({ scope, fetchPeople, selectedId, onPick, detail }: Props<T>) {
  const name = useId()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const people = useQuery({ queryKey: ['people', ...scope, debounced], queryFn: () => fetchPeople(debounced) })

  return (
    <>
      <Field label="Search by name">
        <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Field>
      <div className="max-h-48 overflow-y-auto rounded-md border border-slate-300">
        {people.isPending ? (
          <p className="p-3 text-sm text-slate-500">Loading people...</p>
        ) : people.isError ? (
          <p role="alert" className="p-3 text-sm text-red-600">
            {people.error.message}
          </p>
        ) : people.data.length === 0 ? (
          <p className="p-3 text-sm text-slate-500">No people found.</p>
        ) : (
          people.data.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-slate-50">
              <input
                type="radio"
                name={name}
                checked={selectedId === p.id}
                onChange={() => onPick(p)}
                className="mt-1 accent-indigo-600"
              />
              <span>
                <span className="block font-medium">{p.full_name}</span>
                <span className="block text-xs text-slate-500">{detail(p)}</span>
              </span>
            </label>
          ))
        )}
      </div>
    </>
  )
}
