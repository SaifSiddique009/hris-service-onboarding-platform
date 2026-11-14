import { ChecklistView } from './ChecklistPage'

export const MyOnboardingPage = () => (
  <div className="mx-auto max-w-4xl">
    <ChecklistView path="/onboarding/checklists/me" title="My onboarding" />
  </div>
)
