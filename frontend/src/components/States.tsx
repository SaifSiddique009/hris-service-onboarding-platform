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

interface ErrorProps {
  message: string
  status?: number
  onRetry?: () => void
  action?: ReactNode
}

export function ErrorState({ message, status, onRetry, action }: ErrorProps) {
  const network = status === 0
  const invalid = status === 422
  const generic = status === undefined || status >= 500
  const title = invalid ? 'This address has a value that is not valid' : generic ? 'Something went wrong' : message
  const detail = network
    ? 'Check your connection and try again. Nothing was changed.'
    : invalid
      ? message
      : generic
        ? 'Nothing was changed. Try again in a moment.'
        : undefined
  return (
    <div role="alert" className="max-w-[620px] border-t-2 border-danger py-10">
      <p className={`${eyebrowClass} flex items-center gap-2 text-danger`}>
        <AlertTriangle aria-hidden size={14} strokeWidth={1.8} />
        Couldn’t load
      </p>
      <p className="mt-3 font-serif text-[28px] leading-[1.2]">{network ? message : title}</p>
      {detail && <p className="mt-3 text-[15px] text-n-600">{detail}</p>}
      {invalid ? (
        <div className="mt-6">{action ?? <a href={window.location.pathname}>Reload the page</a>}</div>
      ) : (
        (network || generic) &&
        onRetry && (
          <Button variant="secondary" className="mt-6" onClick={onRetry}>
            <RefreshCw aria-hidden size={16} strokeWidth={1.8} />
            Try again
          </Button>
        )
      )}
    </div>
  )
}
