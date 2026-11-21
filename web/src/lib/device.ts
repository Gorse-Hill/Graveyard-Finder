// Smart TV browsers (LG webOS, Samsung Tizen, and similar) have no camera, GPS, or file picker.
// On a TV the app shows the memorial viewer only. Add ?tv=1 to the address to force this mode.
const TV_PATTERN = /Web0S|webOS|NetCast|SMART-TV|SmartTV|Tizen|HbbTV|Large Screen|AFTM|BRAVIA|Viera/i

export function isTvBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const search = typeof window !== 'undefined' ? window.location.search : ''
  if (/[?&]tv=1\b/.test(search)) return true
  return TV_PATTERN.test(navigator.userAgent)
}

export function isInstalledApp(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches === true
}
