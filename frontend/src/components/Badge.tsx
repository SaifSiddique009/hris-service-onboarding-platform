import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export function Badge({ children, tone = 'bg-grey-soft text-grey' }: { children: ReactNode; tone?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm py-px pl-[7px] pr-2 text-[12.5px] font-semibold leading-5',
        tone,
      )}
    >
      {children}
    </span>
  )
}

export const RoleBadge = ({ children }: { children: ReactNode }) => (
  <span className="whitespace-nowrap rounded-xs border border-ink px-[7px] py-[3px] text-[11px] font-bold uppercase tracking-[.08em]">
    {children}
  </span>
)
