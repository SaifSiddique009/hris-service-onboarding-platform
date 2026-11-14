const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
const TOKEN_KEY = 'access_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

export class ApiError extends Error {
  status: number
  code: string
  fields: Record<string, string>

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

// Where to return after signing in again: the page the person was on.
export const loginPath = () => `/login?next=${encodeURIComponent(location.pathname + location.search)}`

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  try {
    res = await fetch(BASE_URL + path, { ...init, headers })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.')
  }

  if (!res.ok) {
    // The session ended, here or in another tab: go to sign in, never show a half-working page.
    if (res.status === 401 && !['/auth/login', '/auth/forgot-password'].includes(path)) {
      clearToken()
      window.location.assign(loginPath())
    }
    const body = await res.json().catch(() => null)
    if (!body?.error) {
      // Not from our API: the hosting provider's filter answers with its own page.
      const blocked = res.status === 403
      throw new ApiError(
        res.status,
        blocked ? 'BLOCKED' : 'UNKNOWN',
        blocked
          ? 'The network security filter blocked this text. Please rephrase it and try again.'
          : 'Something went wrong on the server. Please try again.',
      )
    }
    throw new ApiError(res.status, body.error.code, body.error.message, body.error.details?.fields)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}
