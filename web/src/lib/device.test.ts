import { describe, expect, it } from 'vitest'
import { matchesTv } from './device'

describe('matchesTv', () => {
  it('recognises common Smart TV browsers', () => {
    expect(matchesTv('Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0 Safari/537.36 WebAppManager')).toBe(true)
    expect(matchesTv('Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 Chrome/76.0 TV Safari/537.36')).toBe(true)
    expect(matchesTv('Mozilla/5.0 (Linux; Android 11; BRAVIA 4K) AppleWebKit/537.36 Chrome/90 Safari/537.36')).toBe(true)
    expect(matchesTv('Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7233) AppleWebKit/537.36 Silk/100')).toBe(true)
  })
  it('leaves phones alone', () => {
    expect(matchesTv('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1')).toBe(false)
    expect(matchesTv('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36')).toBe(false)
  })
  it('allows ?tv=1 to force TV mode', () => {
    expect(matchesTv('Mozilla/5.0 (X11; Linux x86_64)', '?tv=1')).toBe(true)
  })
})
