import { useId, type FormEvent, type ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

interface Props {
  title: string
  eyebrow?: string
  onClose: () => void
  onSubmit: () => void
  pending: boolean
  disabled?: boolean
  error?: string
  submitLabel?: string
  children: ReactNode
}

export function FormDialog({ title, eyebrow, onClose, onSubmit, pending, disabled, error, submitLabel = 'Confirm', children }: Props) {
  const form = useId()
  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit()
  }
  return (
    <Modal
      title={title}
      eyebrow={eyebrow}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={form} loading={pending} disabled={disabled}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={form} onSubmit={submit} className="flex flex-col gap-4">
        {children}
        {error && (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
