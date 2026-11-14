import type { OnboardingTask, TaskAction } from '../../api/types'
import { Button } from '../../components/Button'
import { useOnce } from '../../lib/once'
import type { useTaskAction } from './useTaskAction'

const actionText: Record<TaskAction, string> = { start: 'Start', complete: 'Complete', put_back: 'Put back', reopen: 'Reopen' }
export function TaskActionButtons({ task, act }: { task: OnboardingTask; act: ReturnType<typeof useTaskAction> }) {
  const once = useOnce()
  return task.allowed_actions.map((a) => (
    <Button
      key={a}
      size="sm"
      variant={a === 'complete' || a === 'start' ? 'primary' : 'secondary'}
      loading={act.isPending && act.variables === a}
      disabled={act.isPending}
      onClick={() => once(() => act.mutate(a))}
    >
      {actionText[a]}
    </Button>
  ))
}
