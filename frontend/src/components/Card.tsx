import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

const variants = {
  section: 'border-t border-ink pt-4',
  emphasis: 'border-t-2 border-ink pt-3.5',
  attention: 'border-t-2 border-danger pt-3.5',
  boxed: 'rounded-md border border-line bg-paper px-4 py-3',
}

interface Props {
  children: ReactNode
  variant?: keyof typeof variants
  className?: string
}

export function Card({ children, variant = 'section', className }: Props) {
  return <div className={cn(variants[variant], className)}>{children}</div>
}
