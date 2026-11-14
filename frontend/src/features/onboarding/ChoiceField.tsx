import type { ReactNode } from 'react'

export const ChoiceField = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[13px] font-semibold">{label}</span>
    {children}
  </div>
)
