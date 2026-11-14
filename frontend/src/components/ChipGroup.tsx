import { cn } from '../lib/cn'

interface Props {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  segmented?: boolean
}

// For choosing one of a few options inside a form, in place of a dropdown.
export function ChipGroup({ label, value, options, onChange, segmented }: Props) {
  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap', !segmented && 'gap-1.5')}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'min-h-8 border border-control px-3 text-[13px] font-medium hover:border-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper max-md:min-h-11',
            segmented ? '-ml-px first:ml-0 first:rounded-l-sm last:rounded-r-sm' : 'rounded-sm',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
