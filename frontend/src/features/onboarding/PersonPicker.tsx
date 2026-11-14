import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import type { UserSummary } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { Field, SearchInput } from '../../components/Fields'

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
        <SearchInput placeholder="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Field>
      <div role="radiogroup" aria-label="People" className="max-h-[300px] overflow-y-auto border-t border-ink">
        {people.isPending ? (
          <p className="p-4 text-sm text-n-600">Loading people…</p>
        ) : people.isError ? (
          <p role="alert" className="p-4 text-sm font-medium text-danger">
            {people.error.message}
          </p>
        ) : people.data.length === 0 ? (
          <p className="p-4 text-sm text-n-600">No people found. Try another name.</p>
        ) : (
          people.data.map((p) => {
            const checked = selectedId === p.id
            return (
              <label
                key={p.id}
                className="grid min-h-14 w-full cursor-pointer grid-cols-[36px_1fr_auto] items-center gap-3 border-b border-l-3 border-line border-l-transparent py-2 pl-[11px] pr-3.5 text-left hover:bg-[#f0f2ec] has-checked:border-l-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-focus"
              >
                <input type="radio" name={name} checked={checked} onChange={() => onPick(p)} className="sr-only" />
                <Avatar name={p.full_name} active={checked} />
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-semibold">{p.full_name}</span>
                  <span className="block text-[12.5px] text-muted">{detail(p)}</span>
                </span>
                {checked && <Check aria-hidden size={16} strokeWidth={1.8} className="text-accent" />}
              </label>
            )
          })
        )}
      </div>
    </>
  )
}
