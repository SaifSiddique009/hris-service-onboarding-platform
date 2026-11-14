import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { OnboardingTask, TaskAction } from '../../api/types'
import { toast } from '../../lib/toast'

const doneText: Record<TaskAction, string> = {
  start: 'Task started',
  complete: 'Task completed',
  put_back: 'Task put back',
  reopen: 'Task reopened',
}

export function useTaskAction(task: OnboardingTask) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: TaskAction) =>
      api(`/onboarding/tasks/${task.id}/transitions`, { method: 'POST', body: JSON.stringify({ action }) }),
    onSuccess: (_, action) => toast(doneText[action]),
    // Refetch on failure too: the task may have changed since it was loaded.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['onboarding'] }),
  })
}
