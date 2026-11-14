import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { api, clearToken, getToken, setToken } from '../../api/client'
import type { User } from '../../api/types'
import { AuthContext } from './AuthContext'

interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [hasToken, setHasToken] = useState(() => !!getToken())

  const { data, isPending } = useQuery({
    queryKey: ['me'],
    queryFn: () => api<User>('/auth/me'),
    enabled: hasToken,
    retry: false,
    staleTime: Infinity,
  })

  async function login(email: string, password: string) {
    const res = await api<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setToken(res.access_token)
    queryClient.setQueryData(['me'], res.user)
    setHasToken(true)
  }

  async function logout() {
    try {
      await api<void>('/auth/logout', { method: 'POST' })
    } finally {
      clearToken()
      setHasToken(false)
      queryClient.clear()
    }
  }

  const user = hasToken ? (data ?? null) : null
  return (
    <AuthContext.Provider value={{ user, loading: hasToken && isPending, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
