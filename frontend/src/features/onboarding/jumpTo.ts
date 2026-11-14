export function jumpTo(id: number) {
  const el = document.getElementById(`task-${id}`)
  if (!el) return
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' })
  el.focus({ preventScroll: true })
  el.style.backgroundColor = '#fbf3d9'
  setTimeout(() => (el.style.backgroundColor = ''), 1200)
}
