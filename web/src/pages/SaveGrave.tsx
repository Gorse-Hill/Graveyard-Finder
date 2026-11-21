import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Camera, Check, ImagePlus, LoaderCircle } from 'lucide-react'
import PageHeader, { Notice } from '../components/PageHeader'
import GpsField from '../components/GpsField'
import { processPhoto, toLocalPhoto } from '../lib/photo'
import { saveGrave } from '../lib/db'
import { requestBackgroundSync } from '../lib/pwa'
import { syncConfigured } from '../lib/config'
import type { GpsFix, ProcessedPhoto } from '../types'
import { t } from '../lib/strings'

export default function SaveGravePage() {
  const navigate = useNavigate()
  const [photo, setPhoto] = useState<ProcessedPhoto | null>(null)
  const photoRef = useRef<ProcessedPhoto | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [name, setName] = useState('')
  const [section, setSection] = useState('')
  const [block, setBlock] = useState('')
  const [plot, setPlot] = useState('')
  const [gps, setGps] = useState<GpsFix | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  photoRef.current = photo

  useEffect(() => () => {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current.previewUrl)
  }, [])

  const choosePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPhotoBusy(true)
    setError('')
    try {
      const processed = await processPhoto(file)
      if (photoRef.current) URL.revokeObjectURL(photoRef.current.previewUrl)
      setPhoto(processed)
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : ''
      setError(code === 'photo_type_not_supported' ? t.invalidPhotoType :
        code === 'photo_too_large' ? t.photoTooLarge : t.photoReadError)
    } finally {
      setPhotoBusy(false)
      event.target.value = ''
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return setError(t.nameRequired)
    if (!photo) return setError(t.photoRequired)
    if (!gps) return setError(t.locationRequired)
    setSaving(true)
    setError('')
    try {
      const localPhoto = toLocalPhoto('', photo)
      const grave = await saveGrave({
        name,
        section,
        block,
        plot,
        gpsLat: gps.lat,
        gpsLng: gps.lng,
        gpsAccuracyM: gps.accuracy,
        photo: localPhoto,
      })
      if (syncConfigured) void requestBackgroundSync()
      navigate(`/card/${grave.id}?saved=1`, { replace: true })
    } catch {
      setError(t.saveError)
      setSaving(false)
    }
  }

  return (
    <div className="page-container form-page">
      <PageHeader title={t.saveGrave} intro={t.saveGraveIntro} />
      {error && <Notice tone="error">{error}</Notice>}
      <form onSubmit={submit} noValidate>
        <section className="form-section" aria-labelledby="photo-title">
          <h2 id="photo-title">{t.photo}</h2>
          <p>{t.photoHelp}</p>
          <label className={`photo-picker ${photo ? 'has-photo' : ''}`}>
            {photo ? <img src={photo.previewUrl} alt={t.selectedGraveAlt} /> : <ImagePlus size={44} aria-hidden="true" />}
            <span>{photoBusy ? t.preparingPhoto : photo ? t.changePhoto : t.takePhoto}</span>
            <input type="file" accept="image/jpeg,image/png" capture="environment" onChange={choosePhoto} disabled={photoBusy} />
          </label>
        </section>

        <section className="form-section" aria-labelledby="person-title">
          <h2 id="person-title">{t.personAndPlot}</h2>
          <label className="field-label" htmlFor="grave-name">{t.nameLabel} <span aria-hidden="true">*</span></label>
          <input id="grave-name" className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} autoComplete="off" maxLength={160} required />
          <div className="field-grid-three">
            <div><label className="field-label" htmlFor="section">{t.section}</label><input id="section" className="text-input" value={section} onChange={(e) => setSection(e.target.value)} maxLength={40} /></div>
            <div><label className="field-label" htmlFor="block">{t.block}</label><input id="block" className="text-input" value={block} onChange={(e) => setBlock(e.target.value)} maxLength={40} /></div>
            <div><label className="field-label" htmlFor="plot">{t.plot}</label><input id="plot" className="text-input" value={plot} onChange={(e) => setPlot(e.target.value)} maxLength={40} /></div>
          </div>
        </section>

        <GpsField value={gps} onChange={setGps} />
        <button type="submit" className="button button-primary save-submit" disabled={saving || photoBusy}>
          {saving ? <LoaderCircle className="spin" size={25} aria-hidden="true" /> : <Check size={25} aria-hidden="true" />}
          {saving ? t.saving : t.save}
        </button>
        <p className="form-footnote"><Camera size={17} aria-hidden="true" /> {t.privateOffline}</p>
      </form>
    </div>
  )
}
