import { useEffect, useId, type FormEvent, type ReactNode } from 'react'
import { useOnce } from '../lib/once'
import { toast } from '../lib/toast'
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
  danger?: boolean
  children: ReactNode
}

export function FormDialog({
  title,
  eyebrow,
  onClose,
  onSubmit,
  pending,
  disabled,
  error,
  submitLabel = 'Confirm',
  danger,
  children,
}: Props) {
  const form = useId()
  const once = useOnce()
  useEffect(() => {
    if (error) toast(error, 'error')
  }, [error])
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!pending) once(onSubmit)
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
          <Button type="submit" form={form} variant={danger ? 'danger' : 'primary'} loading={pending} disabled={disabled}>
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
