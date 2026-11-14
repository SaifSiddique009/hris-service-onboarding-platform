import { cn } from '../lib/cn'

interface Tab {
  value: string
  label: string
  count?: number
  hot?: boolean
}

interface Props {
  tabs: Tab[]
  value: string
  onChange: (value: string) => void
  label: string
}

export function Tabs({ tabs, value, onChange, label }: Props) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-7 overflow-x-auto border-b border-control [scrollbar-width:none]">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          onClick={() => onChange(tab.value)}
          className="-mb-px inline-flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 border-transparent text-sm font-medium text-muted hover:text-ink aria-selected:border-ink aria-selected:font-semibold aria-selected:text-ink"
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                'rounded-xs px-1.5 text-xs tabular-nums',
                tab.hot && tab.count > 0 ? 'bg-danger-soft font-semibold text-danger' : 'text-muted',
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
