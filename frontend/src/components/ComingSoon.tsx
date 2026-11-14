import { Card } from './Card'
import { PageHeader } from './PageHeader'

export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <p className="text-slate-500">Coming soon</p>
      </Card>
    </>
  )
}
