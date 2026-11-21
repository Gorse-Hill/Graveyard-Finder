// Smart TV browsers (LG webOS, Samsung Tizen, Android TV, Fire TV and similar) have no camera, GPS, or file picker.
// On a TV the app shows the memorial viewer only. Add ?tv=1 to the address to force this mode.
const TV_PATTERN = /Web0S|webOS|NetCast|SMART-TV|SmartTV|Tizen|HbbTV|Large Screen|AFTM|AFTT|AFTS|BRAVIA|Viera|Android TV|GoogleTV|CrKey|NETTV|SonyDTV|Roku/i

export function matchesTv(userAgent: string, search = ''): boolean {
  if (/[?&]tv=1\b/.test(search)) return true
  return TV_PATTERN.test(userAgent)
}

export function isTvBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const search = typeof window !== 'undefined' ? window.location.search : ''
  return matchesTv(navigator.userAgent, search)
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || iPadOs
}

export function isInstalledApp(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true
}
