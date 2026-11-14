import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  title: string
  eyebrow?: string
  subtitle?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
}

export const eyebrowClass = 'text-[11.5px] font-semibold uppercase tracking-[.08em] text-muted'

export function PageHeader({ title, eyebrow, subtitle, actions, back }: Props) {
  return (
    <div className="mb-7">
      {back && (
        <Link
          to={back.to}
          className="-ml-2.5 mb-4 inline-flex min-h-9 items-center gap-2 rounded-sm px-2.5 text-sm font-medium text-ink no-underline hover:bg-n-100 hover:text-ink"
        >
          <ArrowLeft aria-hidden size={16} strokeWidth={1.8} />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          {eyebrow && <p className={eyebrowClass}>{eyebrow}</p>}
          <h1 className="text-balance font-serif text-[46px] font-normal leading-[1.05] tracking-[-0.02em] max-md:text-[32px]">
            {title}
          </h1>
          {subtitle && <p className="mt-3 max-w-[820px] text-base leading-[1.55] text-n-600">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}
