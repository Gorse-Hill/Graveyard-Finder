import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import QrScanner from '../components/QrScanner'
import TvKeyboard from '../components/TvKeyboard'
import { parseQrInput } from '../lib/domain'
import { isTvBrowser } from '../lib/device'
import { t } from '../lib/strings'

export default function FindMemorialPage() {
  const navigate = useNavigate()
  const tv = isTvBrowser()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const openToken = (token: string) => navigate(`/g/${token}`)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const token = parseQrInput(value)
    if (!token) return setError(t.invalidQr)
    openToken(token)
  }

  return (
    <div className="page-container narrow-page">
      <PageHeader title={t.findMemorial} intro={tv ? t.tvIntro : t.findIntro} />
      {!tv && <QrScanner onToken={openToken} />}
      {!tv && <div className="or-divider"><span>{t.pasteLink}</span></div>}
      {tv && (
        <TvKeyboard
          value={value}
          onChange={(next) => { setValue(next); setError('') }}
          onSubmit={() => {
            const token = parseQrInput(value)
            if (!token) return setError(t.invalidQr)
            openToken(token)
          }}
          error={error}
        />
      )}
      {!tv && <form onSubmit={submit} className="inline-form" noValidate>
        <label className="field-label" htmlFor="family-link">{t.familyCard}</label>
        <input id="family-link" className="text-input" value={value} onChange={(event) => { setValue(event.target.value); setError('') }} placeholder={t.linkPlaceholder} autoCapitalize="characters" autoCorrect="off" />
        {error && <p className="field-error" role="alert">{error}</p>}
        <button type="submit" className="button button-primary">{t.openLink}<ArrowRight size={22} aria-hidden="true" /></button>
      </form>}
    </div>
  )
}
