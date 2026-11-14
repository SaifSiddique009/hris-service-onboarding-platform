import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

export const Table = ({ className, ...props }: HTMLAttributes<HTMLTableElement>) => (
  <table {...props} className={cn('w-full border-collapse border-t border-ink text-sm', className)} />
)

export const Th = ({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    {...props}
    className={cn(
      'border-b border-control bg-page px-3 pb-2.5 pt-3 text-left text-[11.5px] font-semibold uppercase tracking-[.06em] text-muted first:pl-0 last:pr-0',
      className,
    )}
  />
)

export const Td = ({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) => (
  <td {...props} className={cn('border-b border-line px-3 py-[15px] align-middle first:pl-0 last:pr-0', className)} />
)

// A row that opens a record: focusable, and Enter does the same as a click.
export function RowLink({ onOpen, className, ...props }: HTMLAttributes<HTMLTableRowElement> & { onOpen: () => void }) {
  return (
    <tr
      {...props}
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className={cn('cursor-pointer hover:bg-n-100', className)}
    />
  )
}
