import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const control =
  'mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30'

interface FieldProps {
  label: string
  hint?: ReactNode
  error?: string
  children: ReactNode
}

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-xs font-normal text-red-600">
          {error}
        </span>
      )}
    </label>
  )
}

export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={`${control} ${props.className ?? ''}`} />
)

export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={`${control} ${props.className ?? ''}`} />
)

export const Textarea = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea rows={4} {...props} className={`${control} ${props.className ?? ''}`} />
)
