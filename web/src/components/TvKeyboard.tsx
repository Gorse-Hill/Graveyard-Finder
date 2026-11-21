import { useEffect, useRef } from 'react'
import { Delete, Eraser, ArrowRight } from 'lucide-react'
import { t } from '../lib/strings'

// The Family Card code uses the letters A to Z and the digits 2 to 7. A remote control moves
// across this grid with the arrow keys and selects a key with OK.
const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.split('')

export default function TvKeyboard({ value, maxLength = 26, onChange, onSubmit, error }: {
  value: string
  maxLength?: number
  onChange: (next: string) => void
  onSubmit: () => void
  error?: string
}) {
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => { first.current?.focus() }, [])
  const slots = Array.from({ length: maxLength }, (_, index) => value[index] ?? '')

  return (
    <section className="tv-keyboard" aria-label={t.tvKeyboardLabel}>
      <p className="tv-code-display" aria-live="polite">
        {slots.map((char, index) => (
          <span key={index} className={char ? 'tv-slot is-filled' : 'tv-slot'}>{char || '·'}</span>
        ))}
      </p>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="tv-key-grid">
        {KEYS.map((key, index) => (
          <button
            key={key}
            ref={index === 0 ? first : undefined}
            type="button"
            className="tv-key"
            onClick={() => value.length < maxLength && onChange(value + key)}
          >{key}</button>
        ))}
      </div>
      <div className="tv-key-actions">
        <button type="button" className="button button-secondary" onClick={() => onChange(value.slice(0, -1))}>
          <Delete size={24} aria-hidden="true" />{t.tvDelete}
        </button>
        <button type="button" className="button button-secondary" onClick={() => onChange('')}>
          <Eraser size={24} aria-hidden="true" />{t.tvClear}
        </button>
        <button type="button" className="button button-primary" onClick={onSubmit} disabled={value.length !== maxLength}>
          {t.openLink}<ArrowRight size={24} aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
