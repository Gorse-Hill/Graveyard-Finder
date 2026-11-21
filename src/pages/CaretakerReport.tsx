import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Check, ClipboardCheck } from 'lucide-react'
import PageHeader, { Notice } from '../components/PageHeader'
import QrScanner from '../components/QrScanner'
import GpsField from '../components/GpsField'
import { fetchFamily } from '../lib/api'
import { getGraveByToken, getSetting, saveConditionReport } from '../lib/db'
import { parseQrInput } from '../lib/domain'
import { requestBackgroundSync } from '../lib/pwa'
import { syncConfigured } from '../lib/config'
import type { Condition, GpsFix } from '../types'
import { t } from '../lib/strings'

export default function CaretakerReportPage() {
  const [linked, setLinked] = useState<boolean | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [grave, setGrave] = useState<{ token: string; name: string } | null>(null)
  const [condition, setCondition] = useState<Condition>('good')
  const [note, setNote] = useState('')
  const [gps, setGps] = useState<GpsFix | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => { void getSetting('caretaker_linked').then((value) => setLinked(value === '1')) }, [])

  const findGrave = async (raw: string) => {
    const token = parseQrInput(raw)
    if (!token) return setError(t.invalidQr)
    setBusy(true)
    setError('')
    try {
      const local = await getGraveByToken(token)
      if (local) setGrave({ token, name: local.name })
      else {
        const remote = await fetchFamily(token)
        setGrave({ token, name: remote.name })
      }
    } catch {
      setError(t.notFound)
    } finally {
      setBusy(false)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!grave) return setError(t.invalidQr)
    if (!gps) return setError(t.locationRequired)
    setBusy(true)
    setError('')
    try {
      await saveConditionReport({
        graveQrToken: grave.token,
        graveName: grave.name,
        condition,
        note,
        gpsLat: gps.lat,
        gpsLng: gps.lng,
        gpsAccuracyM: gps.accuracy,
      })
      setSaved(true)
      if (syncConfigured) void requestBackgroundSync()
    } catch {
      setError(t.unknownError)
    } finally {
      setBusy(false)
    }
  }

  if (linked === null) return <div className="page-container"><p className="loading-line">{t.openingReport}</p></div>
  if (!linked) return <div className="page-container narrow-page"><PageHeader title={t.report} /><Notice tone="info">{t.signInUnavailable}<p><Link to="/caretaker/sign-in" className="text-link">{t.caretakerSignIn}</Link></p></Notice></div>

  return (
    <div className="page-container form-page">
      <PageHeader title={t.report} intro={t.reportIntro} backTo="/" />
      {error && <Notice tone="error">{error}</Notice>}
      {saved ? (
        <div className="success-state"><Check size={48} aria-hidden="true" /><h2>{t.reportSaved}</h2><p>{t.assignmentNeeded}</p><Link to="/" className="button button-primary">{t.home}</Link></div>
      ) : (
        <form onSubmit={submit}>
          {!grave ? (
            <>
              <QrScanner onToken={(token) => { setTokenInput(token); void findGrave(token) }} />
              <section className="form-section">
                <label className="field-label" htmlFor="report-token">{t.graveToken}</label>
                <input id="report-token" className="text-input" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} placeholder={t.linkPlaceholder} />
                <button type="button" className="button button-secondary" disabled={busy} onClick={() => void findGrave(tokenInput)}>{t.loadGrave}</button>
              </section>
            </>
          ) : (
            <>
              <section className="selected-grave"><span>{t.memorial}</span><h2>{grave.name}</h2><button type="button" className="text-link" onClick={() => setGrave(null)}>{t.scanAnother}</button></section>
              <fieldset className="form-section condition-fieldset">
                <legend>{t.condition}</legend>
                {(['good', 'needs_attention', 'serious_damage'] as Condition[]).map((value) => (
                  <label className={`condition-option condition-${value} ${condition === value ? 'is-selected' : ''}`} key={value}>
                    <input type="radio" name="condition" value={value} checked={condition === value} onChange={() => setCondition(value)} />
                    <span className="condition-dot" aria-hidden="true" />
                    <span>{value === 'good' ? t.good : value === 'needs_attention' ? t.needsAttention : t.seriousDamage}</span>
                  </label>
                ))}
              </fieldset>
              <section className="form-section">
                <label className="field-label" htmlFor="report-note">{t.note}</label>
                <textarea id="report-note" className="text-input" value={note} onChange={(event) => setNote(event.target.value.slice(0, 300))} rows={4} maxLength={300} />
                <p className="field-help">{t.noteHelp} <span>{note.length}/300</span></p>
              </section>
              <GpsField value={gps} onChange={setGps} />
              <p className="field-help">{t.assignmentNeeded}</p>
              <button type="submit" className="button button-primary save-submit" disabled={busy}><ClipboardCheck size={24} aria-hidden="true" />{t.saveReport}</button>
            </>
          )}
        </form>
      )}
    </div>
  )
}
