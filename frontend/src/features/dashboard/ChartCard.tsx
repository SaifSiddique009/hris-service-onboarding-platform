import type { ReactElement } from 'react'
import { ResponsiveContainer } from 'recharts'
import { Card } from '../../components/Card'

export function ChartCard({ title, children }: { title: string; children: ReactElement }) {
  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold text-slate-900">{title}</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
