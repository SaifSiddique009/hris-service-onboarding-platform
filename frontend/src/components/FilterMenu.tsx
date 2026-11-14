import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'

interface Props {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  anyLabel?: string
}

// A menu button with a listbox, used for list filters. An empty value means "Any".
export function FilterMenu({ label, value, options, onChange, anyLabel = 'Any' }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const all = [{ value: '', label: anyLabel }, ...options]
  const current = all.find((o) => o.value === value) ?? all[0]

  useEffect(() => {
    if (!open) return
    const onMouse = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-sm border border-control pl-3 pr-2.5 text-[13px] hover:border-ink max-md:min-h-11',
          value && 'border-ink bg-paper',
        )}
      >
        <span className="text-muted">{label}:</span>
        <b className="font-semibold">{current.label}</b>
        <ChevronDown aria-hidden size={14} strokeWidth={1.8} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-full z-30 mt-1.5 max-h-72 min-w-52 animate-rise overflow-y-auto rounded-md border border-control bg-paper p-1.5 shadow-pop"
        >
          {all.map((option) => (
            <li key={option.value} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={cn(
                  'flex min-h-9 w-full items-center justify-between gap-3 rounded-xs px-2.5 text-left text-[13.5px] hover:bg-n-100',
                  option.value === value && 'bg-accent-soft font-semibold',
                )}
              >
                {option.label}
                {option.value === value && <Check aria-hidden size={14} strokeWidth={1.8} className="text-accent" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
