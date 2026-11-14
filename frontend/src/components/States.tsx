import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { eyebrowClass } from './PageHeader'
import { Spinner } from './Spinner'

export function LoadingState() {
  return (
    <div className="border-t border-ink pt-5">
      <p className="flex items-center gap-2.5 text-sm text-muted">
        <Spinner />
        Loading…
      </p>
      <div className="mt-6 flex flex-col gap-6" aria-hidden>
        {['w-11/12', 'w-4/5', 'w-full', 'w-3/4', 'w-5/6'].map((width) => (
          <div key={width} className={`h-2.5 animate-pulse rounded-xs bg-n-150 ${width}`} />
        ))}
      </div>
    </div>
  )
}

export function EmptyState({ title, help, action }: { title: string; help?: ReactNode; action?: ReactNode }) {
  return (
    <div className="max-w-[520px] border-t border-ink py-14">
      <p className="font-serif text-[28px] leading-[1.2]">{title}</p>
      {help && <p className="mt-3 text-[15px] leading-[1.55] text-n-600">{help}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="max-w-[620px] border-t-2 border-danger py-10">
      <p className={`${eyebrowClass} flex items-center gap-2 text-danger`}>
        <AlertTriangle aria-hidden size={14} strokeWidth={1.8} />
        Couldn’t load
      </p>
      <p className="mt-3 font-serif text-[28px] leading-[1.2]">{message}</p>
      <p className="mt-3 text-[15px] text-n-600">Check your connection and try again. Nothing was changed.</p>
      {onRetry && (
        <Button variant="secondary" className="mt-6" onClick={onRetry}>
          <RefreshCw aria-hidden size={16} strokeWidth={1.8} />
          Try again
        </Button>
      )}
    </div>
  )
}
