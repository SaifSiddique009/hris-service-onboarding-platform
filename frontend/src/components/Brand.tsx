import { cn } from '../lib/cn'

export const Brand = ({ light }: { light?: boolean }) => (
  <span className="flex min-w-0 items-center gap-2.5">
    <span
      aria-hidden
      className={cn(
        'grid size-[30px] place-items-center rounded-xs font-serif text-[17px]',
        light ? 'bg-paper text-ink' : 'bg-ink text-paper',
      )}
    >
      p.
    </span>
    <span className="flex flex-col whitespace-nowrap">
      <span className="font-serif text-xl leading-none whitespace-nowrap">PeopleDesk</span>
      <span className={cn('mt-1 whitespace-nowrap text-[10px] font-semibold uppercase leading-none tracking-[.12em]', light ? 'text-[#a9bcb0]' : 'text-muted')}>
        Next Venture
      </span>
    </span>
  </span>
)
