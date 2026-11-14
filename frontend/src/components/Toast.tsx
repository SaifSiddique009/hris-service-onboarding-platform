import { Check, CircleAlert } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { subscribe, toasts } from '../lib/toast'

export function Toaster() {
  const shown = useSyncExternalStore(subscribe, toasts)
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2">
      {shown.map((item) => (
        <p
          key={item.id}
          role={item.kind === 'error' ? 'alert' : undefined}
          className={`flex max-w-sm animate-rise items-center gap-2.5 rounded-md px-4 py-3 text-sm font-medium shadow-pop ${
            item.kind === 'error' ? 'border border-danger/30 bg-danger-soft text-danger' : 'bg-n-900 text-paper'
          }`}
        >
          {item.kind === 'error' ? (
            <CircleAlert aria-hidden size={16} strokeWidth={2} className="shrink-0" />
          ) : (
            <Check aria-hidden size={16} strokeWidth={2} className="shrink-0 text-[#9fd3bd]" />
          )}
          {item.message}
        </p>
      ))}
    </div>
  )
}
