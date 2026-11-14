import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { Spinner } from './Spinner'

export function QueryBoundary<T>({ query, children }: { query: UseQueryResult<T>; children: (data: T) => ReactNode }) {
  if (query.isPending) {
    return (
      <div className="flex justify-center py-16 text-indigo-600">
        <Spinner />
      </div>
    )
  }
  if (query.isError) {
    return (
      <Card>
        <p role="alert" className="text-sm text-red-600">
          {query.error.message}
        </p>
        <Button variant="secondary" className="mt-3" onClick={() => query.refetch()}>
          Try again
        </Button>
      </Card>
    )
  }
  return <>{children(query.data)}</>
}
