import type { ReactElement, ReactNode } from 'react'
import { ResponsiveContainer } from 'recharts'
import { Card } from '../../components/Card'

export const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface Props {
  title: string
  subtitle?: string
  rows?: number
  children: ReactNode
}

export function ChartCard({ title, subtitle, rows, children }: Props) {
  return (
    <Card>
      <h2 className="font-serif text-[21px] leading-snug">{title}</h2>
      <p className="mb-5 min-h-5 text-[13px] text-muted">{subtitle}</p>
      {rows === undefined ? (
        children
      ) : (
        <div style={{ height: rows * 32 + 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            {children as ReactElement}
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
