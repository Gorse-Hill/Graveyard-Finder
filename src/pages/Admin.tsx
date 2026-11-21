import { useState, type FormEvent } from 'react'
import { Check, KeyRound, RefreshCw, ShieldCheck, UserRoundCheck } from 'lucide-react'
import PageHeader, { Notice } from '../components/PageHeader'
import { adminAction } from '../lib/api'
import { syncConfigured } from '../lib/config'
import { conditionLabel } from '../lib/domain'
import type { Condition } from '../types'
import { t } from '../lib/strings'

interface Cemetery { id: string; name: string; municipality: string | null }
interface AdminReport { id: string; grave_name: string; condition: Condition; note: string | null; visit_date: string; status: string }
interface AdminConflict { id: string; entity: string; entity_id: string; current_version: number; created_at: string }
type Tab = 'assign' | 'reports' | 'conflicts'

export default function AdminPage() {
  const [secret, setSecret] = useState('')
  const [connected, setConnected] = useState(false)
  const [tab, setTab] = useState<Tab>('assign')
  const [cemeteries, setCemeteries] = useState<Cemetery[]>([])
  const [reports, setReports] = useState<AdminReport[]>([])
  const [conflicts, setConflicts] = useState<AdminConflict[]>([])
  const [userId, setUserId] = useState('')
  const [cemeteryId, setCemeteryId] = useState('')
  const [section, setSection] = useState('')
  const [resolution, setResolution] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = async (currentSecret = secret) => {
    const [cemeteryResult, reportResult, conflictResult] = await Promise.all([
      adminAction<{ items: Cemetery[] }>(currentSecret, { action: 'list_cemeteries' }),
      adminAction<{ items: AdminReport[] }>(currentSecret, { action: 'list_reports' }),
      adminAction<{ items: AdminConflict[] }>(currentSecret, { action: 'list_conflicts' }),
    ])
    setCemeteries(cemeteryResult.items)
    setReports(reportResult.items)
    setConflicts(conflictResult.items)
  }

  const connect = async (event: FormEvent) => {
    event.preventDefault()
    if (!secret) return setError(t.adminSecretRequired)
    setBusy(true)
    setError('')
    try {
      await load()
      setConnected(true)
    } catch (cause) {
      setError(cause instanceof Error && cause.message === 'not_configured'
        ? t.adminUnavailable
        : cause instanceof Error ? cause.message : t.unknownError)
    } finally {
      setBusy(false)
    }
  }

  const assign = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await adminAction(secret, { action: 'assign_caretaker', caretaker_user_id: userId, cemetery_id: cemeteryId, section })
      setMessage(t.caretakerAssigned)
      setUserId('')
      setSection('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.unknownError)
    } finally {
      setBusy(false)
    }
  }

  const publish = async (id: string) => {
    setBusy(true)
    setError('')
    try {
      await adminAction(secret, { action: 'publish_report', report_id: id })
      setMessage(t.reportPublished)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.unknownError)
    } finally {
      setBusy(false)
    }
  }

  const resolve = async (id: string) => {
    setBusy(true)
    setError('')
    try {
      await adminAction(secret, { action: 'resolve_conflict', conflict_id: id, resolution: resolution[id] ?? '' })
      setMessage(t.conflictResolved)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.unknownError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-container admin-page">
      <PageHeader title={t.adminTitle} intro={t.adminIntro} />
      {!syncConfigured && <Notice tone="info">{t.adminUnavailable}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
      {!connected ? (
        <form onSubmit={connect} className="form-section admin-connect">
          <KeyRound size={34} aria-hidden="true" />
          <label className="field-label" htmlFor="admin-secret">{t.adminSecret}</label>
          <input id="admin-secret" className="text-input" type="password" value={secret} onChange={(event) => setSecret(event.target.value)} autoComplete="off" />
          <p className="field-help">{t.adminSecretHelp}</p>
          <button type="submit" className="button button-primary" disabled={busy}><ShieldCheck size={22} aria-hidden="true" />{busy ? t.connecting : t.connectAdmin}</button>
        </form>
      ) : (
        <>
          <div className="admin-tabs" role="tablist" aria-label={t.adminViews}>
            {(['assign', 'reports', 'conflicts'] as Tab[]).map((value) => <button type="button" role="tab" aria-selected={tab === value} className={tab === value ? 'is-active' : ''} onClick={() => setTab(value)} key={value}>{value === 'assign' ? t.assign : value === 'reports' ? `${t.reports} (${reports.length})` : `${t.conflicts} (${conflicts.length})`}</button>)}
          </div>
          {tab === 'assign' && (
            <form onSubmit={assign} className="form-section admin-section" role="tabpanel">
              <h2>{t.assign}</h2>
              <label className="field-label" htmlFor="caretaker-id">{t.userId}</label>
              <input id="caretaker-id" className="text-input" value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="UUID" required />
              <label className="field-label" htmlFor="cemetery-id">{t.cemeteryId}</label>
              {cemeteries.length ? <select id="cemetery-id" className="text-input" value={cemeteryId} onChange={(event) => setCemeteryId(event.target.value)} required><option value="">{t.chooseCemetery}</option>{cemeteries.map((cemetery) => <option value={cemetery.id} key={cemetery.id}>{cemetery.name}{cemetery.municipality ? ` — ${cemetery.municipality}` : ''}</option>)}</select> : <input id="cemetery-id" className="text-input" value={cemeteryId} onChange={(event) => setCemeteryId(event.target.value)} placeholder="UUID" required />}
              <label className="field-label" htmlFor="assign-section">{t.section}</label>
              <input id="assign-section" className="text-input" value={section} onChange={(event) => setSection(event.target.value)} maxLength={40} required />
              <button type="submit" className="button button-primary" disabled={busy}><UserRoundCheck size={22} aria-hidden="true" />{t.assignAction}</button>
            </form>
          )}
          {tab === 'reports' && (
            <section className="admin-list" role="tabpanel">
              {reports.length === 0 ? <p className="empty-state">{t.noAdminData}</p> : reports.map((report) => <article className="admin-row" key={report.id}><div><span className={`condition-text condition-${report.condition}`}>{conditionLabel(report.condition)}</span><h2>{report.grave_name}</h2>{report.note && <p>{report.note}</p>}<small>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(report.visit_date))} · {t.reportStatus(report.status)}</small></div>{report.status !== 'published' && <button type="button" className="button button-secondary" disabled={busy} onClick={() => void publish(report.id)}><Check size={19} aria-hidden="true" />{t.publish}</button>}</article>)}
            </section>
          )}
          {tab === 'conflicts' && (
            <section className="admin-list" role="tabpanel">
              {conflicts.length === 0 ? <p className="empty-state">{t.noAdminData}</p> : conflicts.map((conflict) => <article className="admin-row conflict-row" key={conflict.id}><div><h2>{conflict.entity}</h2><p>{conflict.entity_id} · {t.currentVersion(conflict.current_version)}</p><label className="field-label" htmlFor={`resolution-${conflict.id}`}>{t.resolution}</label><input id={`resolution-${conflict.id}`} className="text-input" value={resolution[conflict.id] ?? ''} onChange={(event) => setResolution((current) => ({ ...current, [conflict.id]: event.target.value }))} /></div><button type="button" className="button button-secondary" disabled={busy || !(resolution[conflict.id] ?? '').trim()} onClick={() => void resolve(conflict.id)}><Check size={19} aria-hidden="true" />{t.resolve}</button></article>)}
            </section>
          )}
          <button type="button" className="button button-quiet admin-refresh" disabled={busy} onClick={() => void load()}><RefreshCw size={19} aria-hidden="true" />{t.refreshData}</button>
        </>
      )}
    </div>
  )
}
