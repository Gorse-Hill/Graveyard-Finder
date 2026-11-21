import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { CalendarDays, ImageOff, MapPin, Navigation, RefreshCw } from 'lucide-react'
import PageHeader, { Notice } from '../components/PageHeader'
import { cachedFamily, cachePhotoById, fetchFamily } from '../lib/api'
import { getGraveByToken, getLocalPhoto } from '../lib/db'
import { isTvBrowser } from '../lib/device'
import { conditionLabel, directionsUrl, locationInWords } from '../lib/domain'
import type { FamilyResponse } from '../types'
import { t } from '../lib/strings'

function FamilyPhoto({ id, url, name }: { id: string; url: string; name: string }) {
  const [src, setSrc] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let objectUrl = ''
    let active = true
    const loadPhoto = url === 'local'
      ? getLocalPhoto(id).then((photo) => {
          if (!photo) throw new Error('photo_unavailable')
          return photo.blob
        })
      : cachePhotoById(id, url)
    void loadPhoto.then((blob) => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setSrc(objectUrl)
    }).catch(() => active && setFailed(true))
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id, url])
  if (failed) return <div className="photo-unavailable"><ImageOff size={28} aria-hidden="true" /><span>{t.photoOffline}</span></div>
  if (!src) return <div className="photo-loading" aria-label={t.loadingPhoto} />
  return <img className="memorial-photo" src={src} alt={t.gravePhotoAlt(name)} />
}

export default function FamilyViewPage() {
  const tv = isTvBrowser()
  const { token = '' } = useParams()
  const [family, setFamily] = useState<FamilyResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const local = await getGraveByToken(token)
      if (local) {
        setFamily({
          name: local.name,
          status: local.status,
          location: { section: local.section || null, block: local.block || null, plot: local.plot || null },
          coordinates: { lat: local.gpsLat, lng: local.gpsLng },
          photos: [{ id: local.photoId, url: 'local' }],
          reports: [],
        })
        return
      }
      if (!navigator.onLine) {
        const cached = await cachedFamily(token)
        if (cached) setFamily(cached)
        else setError('offline')
        return
      }
      try {
        setFamily(await fetchFamily(token))
      } catch (cause) {
        const cached = await cachedFamily(token)
        if (cached && cause instanceof Error && cause.message !== 'not_found') setFamily(cached)
        else throw cause
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'offline')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void load() }, [load])

  return (
    <div className="page-container memorial-page">
      <PageHeader title={t.memorial} backTo="/find" />
      {loading && <p className="loading-line">{t.openingMemorial}</p>}
      {!loading && error && (
        <Notice tone={error === 'not_found' ? 'error' : 'warning'}>
          <strong>{error === 'not_found' ? t.notFound : t.memorialUnavailable}</strong>
          {error !== 'not_found' && <p>{t.memorialUnavailableHelp}</p>}
          <button type="button" className="button button-secondary" onClick={load}><RefreshCw size={20} aria-hidden="true" />{t.retry}</button>
        </Notice>
      )}
      {!loading && family && (
        <article className="memorial-content">
          <header className="memorial-heading">
            <p className="overline">{t.memorial}</p>
            <h1>{family.name}</h1>
            <p><MapPin size={22} aria-hidden="true" />{locationInWords(family.location)}</p>
          </header>
          {family.photos.length > 0 && (
            <div className="memorial-gallery">
              {family.photos.map((photo) => <FamilyPhoto key={photo.id} id={photo.id} url={photo.url} name={family.name} />)}
            </div>
          )}
          {!tv && <a className="button button-primary directions-button" href={directionsUrl(family.coordinates.lat, family.coordinates.lng)} target="_blank" rel="noreferrer">
            <Navigation size={24} aria-hidden="true" />{t.directions}
          </a>}
          <p className="coordinates">GPS {family.coordinates.lat.toFixed(6)}, {family.coordinates.lng.toFixed(6)}</p>
          <section className="report-history" aria-labelledby="report-history-title">
            <h2 id="report-history-title">{t.visitReports}</h2>
            {family.reports.length === 0 ? <p>{t.noReports}</p> : family.reports.map((report, index) => (
              <div className="visit-row" key={`${report.visit_date}-${index}`}>
                <span className={`condition-dot condition-${report.condition}`} aria-hidden="true" />
                <div><strong>{conditionLabel(report.condition)}</strong>{report.note && <p>{report.note}</p>}<small><CalendarDays size={15} aria-hidden="true" />{new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date(report.visit_date))}</small></div>
              </div>
            ))}
          </section>
        </article>
      )}
    </div>
  )
}
