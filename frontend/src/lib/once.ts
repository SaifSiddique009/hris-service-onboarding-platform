import { useRef } from 'react'

// A double-click fires twice before the button can be disabled; this lets only the first through.
export function useOnce() {
  const last = useRef(0)
  return (run: () => void) => {
    const now = Date.now()
    if (now - last.current < 800) return
    last.current = now
    run()
  }
}
