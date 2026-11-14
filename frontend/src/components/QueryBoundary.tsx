import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ErrorState, LoadingState } from './States'

export function QueryBoundary<T>({ query, children }: { query: UseQueryResult<T>; children: (data: T) => ReactNode }) {
  if (query.isPending) return <LoadingState />
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
  return <>{children(query.data)}</>
}
