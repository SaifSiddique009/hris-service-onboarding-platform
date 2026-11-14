import { cn } from '../lib/cn'

export function Avatar({ name, active }: { name: string; active?: boolean }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-full text-[12.5px] font-semibold',
        active ? 'bg-accent text-paper' : 'bg-n-150',
      )}
    >
      {initials}
    </span>
  )
}
