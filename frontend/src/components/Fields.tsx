import { ChevronDown, Search } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

const control =
  'w-full min-h-10 rounded-sm border border-control bg-paper px-3 text-sm font-normal text-ink placeholder:text-n-500 hover:border-n-400 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent-soft aria-[invalid=true]:border-danger aria-[invalid=true]:ring-3 aria-[invalid=true]:ring-danger-soft disabled:border-grey-soft disabled:bg-grey-soft disabled:text-[#8a948d] max-md:min-h-11'

interface FieldProps {
  label: string
  hint?: ReactNode
  error?: string
  children: ReactNode
}

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
      {label}
      {children}
      {hint && <span className="font-normal text-muted">{hint}</span>}
      {error && (
        <span role="alert" className="font-medium text-danger">
          {error}
        </span>
      )}
    </label>
  )
}

export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={cn(control, props.className)} />
)

export const SearchInput = (props: InputHTMLAttributes<HTMLInputElement>) => (
  <span className="relative block">
    <Search aria-hidden size={16} strokeWidth={1.8} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
    <Input type="search" {...props} className={cn('pl-[34px]', props.className)} />
  </span>
)

export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => (
  <span className="relative block">
    <select {...props} className={cn(control, 'appearance-none pr-9', props.className)} />
    <ChevronDown aria-hidden size={16} strokeWidth={1.8} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
  </span>
)

export const Textarea = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea rows={4} {...props} className={cn(control, 'min-h-26 resize-y py-2.5 leading-normal', props.className)} />
)
