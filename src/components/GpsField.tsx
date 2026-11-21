import { useEffect, useRef, useState } from 'react'
import { LocateFixed, RefreshCw } from 'lucide-react'
import type { GpsFix } from '../types'
import { t } from '../lib/strings'

export default function GpsField({ value, onChange }: {
  value: GpsFix | null
  onChange: (fix: GpsFix) => void
}) {
  const [status, setStatus] = useState<'idle' | 'locating' | 'denied' | 'unavailable'>('idle')
  const watchId = useRef<number | null>(null)

  const stop = () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
  }

  const start = () => {
    if (!navigator.geolocation) {
      setStatus('unavailable')
      return
    }
    stop()
    setStatus('locating')
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        onChange({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
        setStatus('idle')
      },
      (error) => setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    )
  }

  useEffect(() => {
    start()
    return stop
    // The watcher is intentionally started once for this form instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="form-section gps-section" aria-labelledby="gps-title">
      <div className="section-title-row">
        <div>
          <h2 id="gps-title">{t.location}</h2>
          <p>{t.locationHelp}</p>
        </div>
        <LocateFixed size={28} aria-hidden="true" />
      </div>
      {value ? (
        <div className="gps-readout" aria-live="polite">
          <div><span>{t.accuracy}</span><strong>±{Math.round(value.accuracy)} m</strong></div>
          <code>{value.lat.toFixed(6)}, {value.lng.toFixed(6)}</code>
        </div>
      ) : (
        <div className="gps-empty" aria-live="polite">
          {status === 'locating' ? t.locating : status === 'denied' ? t.locationDenied : status === 'unavailable' ? t.locationUnavailable : t.locationRequired}
        </div>
      )}
      {status === 'denied' && value && <p className="field-error">{t.locationDenied}</p>}
      <button type="button" className="button button-secondary" onClick={start} disabled={status === 'locating'}>
        <RefreshCw size={21} aria-hidden="true" />
        {status === 'locating' ? t.locating : t.getLocation}
      </button>
    </section>
  )
}
