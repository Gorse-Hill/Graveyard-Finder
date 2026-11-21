import { useCallback, useEffect, useState } from 'react'
import { Check, CloudUpload, Clock3, RefreshCw, TriangleAlert } from 'lucide-react'
import PageHeader, { Notice } from '../components/PageHeader'
import { listSyncQueue } from '../lib/db'
import { syncConfigured } from '../lib/config'
import { syncNow } from '../lib/sync'
import type { SyncEvent } from '../types'
import { t } from '../lib/strings'

function stateLabel(state: SyncEvent['state']): string {
  return { queued: t.pending, retry: t.retrying, rejected: t.rejected, conflict: t.conflict, sent: t.sent }[state]
}

export default function QueuePage() {
  const [events, setEvents] = useState<SyncEvent[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const refresh = useCallback(async () => setEvents(await listSyncQueue()), [])
  useEffect(() => { void refresh() }, [refresh])

  const runSync = async () => {
    if (!syncConfigured) return setMessage(t.queueLocalOnly)
    setBusy(true)
    setMessage('')
    try {
      const started = await syncNow()
      setMessage(started ? t.syncComplete : t.syncAlreadyRunning)
      await refresh()
      window.dispatchEvent(new Event('graveyard-synced'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-container queue-page">
      <PageHeader title={t.queue} intro={t.privateOffline} />
      {!syncConfigured && <Notice tone="info">{t.queueLocalOnly}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
      <button type="button" className="button button-primary" onClick={runSync} disabled={busy}><CloudUpload size={23} aria-hidden="true" />{busy ? t.syncing : t.syncNow}</button>
      {events.length === 0 ? (
        <div className="empty-state"><Check size={38} aria-hidden="true" /><p>{t.queueEmpty}</p></div>
      ) : (
        <div className="queue-list">
          {events.map((event) => (
            <article className="queue-row" key={event.clientEventId}>
              <div className="queue-row-heading">
                <span className={`queue-state state-${event.state}`}>
                  {event.state === 'sent' ? <Check size={16} aria-hidden="true" /> : event.state === 'retry' || event.state === 'queued' ? <Clock3 size={16} aria-hidden="true" /> : <TriangleAlert size={16} aria-hidden="true" />}
                  {stateLabel(event.state)}
                </span>
                <time dateTime={event.createdAt}>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.createdAt))}</time>
              </div>
              <h2>{typeof event.payload.name === 'string' ? event.payload.name : event.entity === 'condition_reports' ? t.report : event.entityId}</h2>
              <p>{event.entity === 'condition_reports' ? t.report : t.saveGrave} · {t.recordVersion(event.entityVersion)}</p>
              {event.nextAttemptAt && <p className="queue-reason"><RefreshCw size={15} aria-hidden="true" /> {t.nextAttempt(new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.nextAttemptAt)))}</p>}
              {event.lastError && <p className="queue-reason">{event.lastError}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
