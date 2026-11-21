import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, Check, MessageSquareText } from 'lucide-react'
import PageHeader, { Notice } from '../components/PageHeader'
import { requestPhoneCode, verifyPhoneAndLink } from '../lib/api'
import { getSetting } from '../lib/db'
import { normalizePhone } from '../lib/domain'
import { authConfigured, syncConfigured } from '../lib/config'
import { t } from '../lib/strings'

export default function CaretakerSignInPage() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'code' | 'done'>('phone')
  const [seconds, setSeconds] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [linked, setLinked] = useState(false)

  useEffect(() => { void getSetting('caretaker_linked').then((value) => setLinked(value === '1')) }, [])
  useEffect(() => {
    if (seconds <= 0) return
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [seconds])

  const sendCode = async (event?: FormEvent) => {
    event?.preventDefault()
    const normalized = normalizePhone(phone)
    if (!normalized) return setError(t.phoneInvalid)
    setPhone(normalized)
    setBusy(true)
    setError('')
    try {
      await requestPhoneCode(normalized)
      setStep('code')
      setSeconds(60)
    } catch (cause) {
      setError(cause instanceof Error && cause.message === 'not_configured' ? t.signInUnavailable : cause instanceof Error ? cause.message : t.unknownError)
    } finally {
      setBusy(false)
    }
  }

  const verify = async (event: FormEvent) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) return setError(t.codeInvalid)
    setBusy(true)
    setError('')
    try {
      await verifyPhoneAndLink(phone, code)
      setStep('done')
      setLinked(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.unknownError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-container narrow-page">
      <PageHeader title={t.caretakerSignIn} intro={t.reportIntro} />
      {(!authConfigured || !syncConfigured) && <Notice tone="info">{t.signInUnavailable}</Notice>}
      {linked && step !== 'done' && <Notice tone="success">{t.deviceLinked}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {step === 'done' ? (
        <div className="success-state"><Check size={46} aria-hidden="true" /><h2>{t.signInSuccess}</h2><button className="button button-primary" onClick={() => navigate('/caretaker/report')}>{t.report}<ArrowRight size={22} aria-hidden="true" /></button></div>
      ) : step === 'phone' ? (
        <form onSubmit={sendCode} className="form-section">
          <label className="field-label" htmlFor="phone">{t.phoneLabel}</label>
          <input id="phone" type="tel" className="text-input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+252 63 123 4567" autoComplete="tel" />
          <p className="field-help">{t.phoneHelp}</p>
          <button type="submit" className="button button-primary" disabled={busy}><MessageSquareText size={22} aria-hidden="true" />{busy ? t.sendingCode : t.sendCode}</button>
          {linked && <Link to="/caretaker/report" className="button button-secondary">{t.report}<ArrowRight size={22} aria-hidden="true" /></Link>}
        </form>
      ) : (
        <form onSubmit={verify} className="form-section">
          <p>{t.codeSentTo(phone)}</p>
          <label className="field-label" htmlFor="sms-code">{t.codeLabel}</label>
          <input id="sms-code" className="text-input code-input" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" />
          <button type="submit" className="button button-primary" disabled={busy}>{busy ? t.verifying : t.verifyCode}</button>
          <button type="button" className="button button-quiet" disabled={seconds > 0 || busy} onClick={() => void sendCode()}>{seconds > 0 ? `${t.resendIn} ${seconds}s` : t.resend}</button>
        </form>
      )}
    </div>
  )
}
