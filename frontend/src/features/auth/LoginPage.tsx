import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { Button } from '../../components/Button'
import { Field, Input } from '../../components/Fields'
import { useAuth } from './AuthContext'
import { homePath } from './roles'

export function LoginPage() {
  const { user, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to={homePath(user.role)} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span aria-hidden className="grid size-[30px] place-items-center bg-ink font-serif text-lg text-paper">
            p.
          </span>
          <span className="font-serif text-xl">PeopleDesk</span>
        </div>
        <h1 className="mb-6 font-serif text-[32px] font-normal leading-[1.1] tracking-[-0.02em]">Sign in</h1>
        <form onSubmit={onSubmit} className="flex flex-col gap-4 border-t border-ink pt-6">
          <Field label="Email">
            <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {error}
            </p>
          )}
          <Button type="submit" loading={loading} className="w-full">
            Sign in
          </Button>
          {loading && (
            <p className="text-center text-[13px] text-muted">
              The server sleeps when idle. The first sign-in can take up to a minute.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
