import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './Button'

interface Props {
  title: string
  eyebrow?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

// The native dialog gives the focus trap, Esc to close and focus return for free.
export function Modal({ title, eyebrow, onClose, children, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    const field = dialog.querySelector<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role=radio]:not([disabled])',
    )
    ;(field ?? dialog).focus()
  }, [])

  return (
    <dialog
      ref={ref}
      tabIndex={-1}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current.close()}
      className="m-auto w-[calc(100%-3rem)] max-w-[560px] animate-rise rounded-md bg-paper p-0 text-ink shadow-dialog focus:outline-none backdrop:bg-[rgb(18_36_33/.5)] max-md:mb-0 max-md:w-full max-md:max-w-none max-md:rounded-b-none max-md:rounded-t-[14px]"
    >
      <div className="flex max-h-[calc(100vh-48px)] flex-col max-md:max-h-[92vh]">
        <header className="flex justify-between gap-4 border-b border-line px-6 pb-4 pt-[22px]">
          <div>
            {eyebrow && <p className="text-[11.5px] font-semibold uppercase tracking-[.08em] text-muted">{eyebrow}</p>}
            <h2 className="font-serif text-[28px] leading-[1.2]">{title}</h2>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={() => ref.current?.close()}>
            <X aria-hidden size={16} strokeWidth={1.8} />
          </Button>
        </header>
        <div className="overflow-y-auto px-6 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-6 pb-5 pt-4">{footer}</footer>}
      </div>
    </dialog>
  )
}
