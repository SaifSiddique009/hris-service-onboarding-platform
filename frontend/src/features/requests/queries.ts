import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Country, Department, RequestCategory } from '../../api/types'

const useStaticList = <T>(path: string, enabled = true) =>
  useQuery({ queryKey: [path], queryFn: () => api<T[]>(path), staleTime: Infinity, enabled })

export const useCategories = () => useStaticList<RequestCategory>('/request-categories')
export const useDepartments = () => useStaticList<Department>('/departments')
export const useCountries = (enabled: boolean) => useStaticList<Country>('/countries', enabled)
