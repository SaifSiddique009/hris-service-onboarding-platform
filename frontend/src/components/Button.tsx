import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../lib/cn'
import { Spinner } from './Spinner'

const base =
  'inline-flex items-center justify-center gap-2 rounded-sm text-sm font-semibold whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:border-n-300 disabled:bg-grey-soft disabled:text-n-500'

const variants = {
  primary: 'border border-accent bg-accent text-paper hover:border-accent-hover hover:bg-accent-hover active:bg-accent-press',
  secondary: 'border border-control bg-transparent text-ink hover:bg-n-100 active:border-n-400 active:bg-n-150',
  danger: 'border border-[#ddb8ae] bg-transparent text-danger hover:bg-danger-soft active:border-danger',
  ghost: 'border border-transparent bg-transparent px-2.5 font-medium text-ink hover:bg-n-100',
}

const sizes = {
  md: 'min-h-10 px-4 max-md:min-h-11',
  sm: 'min-h-8 px-3 text-[13px] max-md:min-h-11',
  icon: 'size-10 p-0 max-md:size-11',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  loading?: boolean
}

export function Button({ variant = 'primary', size = 'md', loading, disabled, className, children, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, sizes[size], variants[variant], className)}
    >
      {loading && <Spinner className={cn('size-3.5', variant === 'primary' && 'border-white/35 border-t-white')} />}
      {children}
    </button>
  )
}
