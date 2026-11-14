import type { ReactNode } from 'react'

export function Badge({ children, tone = 'bg-indigo-50 text-indigo-700' }: { children: ReactNode; tone?: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {children}
    </span>
  )
}
