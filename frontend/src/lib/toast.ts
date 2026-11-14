interface Item {
  id: number
  message: string
  kind: 'success' | 'error'
}

let items: Item[] = []
const listeners = new Set<() => void>()

function set(next: Item[]) {
  items = next
  listeners.forEach((notify) => notify())
}

// Call from anywhere after an action succeeds: toast('Assigned to Nuwan Bandara').
export function toast(message: string, kind: Item['kind'] = 'success') {
  if (items.some((item) => item.message === message && item.kind === kind)) return
  const id = Date.now() + Math.random()
  set([...items, { id, message, kind }])
  setTimeout(() => set(items.filter((item) => item.id !== id)), kind === 'error' ? 6000 : 4000)
}

export const toasts = () => items

export function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => listeners.delete(notify)
}
