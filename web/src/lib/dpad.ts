// Remote-control navigation for Smart TVs. Arrow keys move focus to the nearest control in that direction.
type Direction = 'left' | 'right' | 'up' | 'down'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]'
const BACK_KEY_CODES = [461, 10009]

function visibleControls(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => {
    const box = element.getBoundingClientRect()
    return box.width > 0 && box.height > 0
  })
}

function center(box: DOMRect): { x: number; y: number } {
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

export function moveFocus(direction: Direction): boolean {
  const controls = visibleControls()
  const current = document.activeElement as HTMLElement | null
  if (!current || !controls.includes(current)) {
    controls[0]?.focus()
    return controls.length > 0
  }
  const from = center(current.getBoundingClientRect())
  let best: HTMLElement | null = null
  let bestScore = Infinity
  for (const element of controls) {
    if (element === current) continue
    const to = center(element.getBoundingClientRect())
    const dx = to.x - from.x
    const dy = to.y - from.y
    const along = direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy
    if (along <= 1) continue
    const across = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx)
    const score = along + across * 2
    if (score < bestScore) {
      bestScore = score
      best = element
    }
  }
  if (!best) return false
  best.focus()
  best.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  return true
}

export function installDpad(): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (BACK_KEY_CODES.includes(event.keyCode) || event.key === 'XF86Back' || event.key === 'GoBack') {
      event.preventDefault()
      window.history.back()
      return
    }
    const direction: Direction | null =
      event.key === 'ArrowLeft' ? 'left' :
      event.key === 'ArrowRight' ? 'right' :
      event.key === 'ArrowUp' ? 'up' :
      event.key === 'ArrowDown' ? 'down' : null
    if (!direction) return
    const target = event.target as HTMLElement | null
    if (target?.tagName === 'INPUT' && (direction === 'left' || direction === 'right')) return
    if (moveFocus(direction)) event.preventDefault()
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}
