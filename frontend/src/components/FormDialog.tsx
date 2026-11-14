import type { FormEvent, ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

interface Props {
  title: string
  onClose: () => void
  onSubmit: () => void
  pending: boolean
  disabled?: boolean
  error?: string
  submitLabel?: string
  children: ReactNode
}

export function FormDialog({ title, onClose, onSubmit, pending, disabled, error, submitLabel = 'Confirm', children }: Props) {
  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit()
  }
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {children}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending} disabled={disabled}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
