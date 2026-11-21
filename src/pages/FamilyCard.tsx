import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { QRCodeSVG } from 'qrcode.react'
import { Check, Copy, ExternalLink, Printer, Share2 } from 'lucide-react'
import PageHeader, { Notice } from '../components/PageHeader'
import { getGrave } from '../lib/db'
import { familyUrl, locationInWords } from '../lib/domain'
import type { Grave } from '../types'
import { t } from '../lib/strings'

export default function FamilyCardPage() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const [grave, setGrave] = useState<Grave | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    void getGrave(id).then((value) => {
      setGrave(value ?? null)
      setLoaded(true)
    })
  }, [id])

  if (!loaded) return <div className="page-container"><p className="loading-line">{t.openingFamilyCard}</p></div>
  if (!grave) return <div className="page-container"><PageHeader title={t.familyCard} /><Notice tone="error">{t.notFound}</Notice></div>

  const url = familyUrl(grave.qrToken)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2500)
  }
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${t.familyCard}: ${grave.name}`, text: grave.name, url })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    await copy()
  }

  return (
    <div className="page-container card-page">
      <div className="screen-only">
        {searchParams.get('saved') === '1' && <Notice tone="success"><strong>{t.savedTitle}</strong><br />{t.savedBody}</Notice>}
        <PageHeader title={t.familyCard} intro={t.familyCardHelp} backTo="/" />
      </div>
      <article className="family-card-print">
        <div className="card-brand"><span className="wordmark-mark" aria-hidden="true">GF</span><span>{t.appName}</span></div>
        <p className="overline">{t.memorial}</p>
        <h1>{grave.name}</h1>
        <p className="card-location">{locationInWords(grave)}</p>
        <div className="qr-wrap">
          <QRCodeSVG value={url} size={256} level="M" marginSize={2} bgColor="#fffdf8" fgColor="#102f2a" title={`${t.familyCard}: ${grave.name}`} />
        </div>
        <p className="scan-instruction">{t.familyCardHelp}</p>
        <code className="family-url">{url}</code>
      </article>
      <div className="card-actions screen-only">
        <Link to={`/g/${grave.qrToken}`} className="button button-primary"><ExternalLink size={22} aria-hidden="true" />{t.openMemorial}</Link>
        <button type="button" className="button button-secondary" onClick={share}><Share2 size={22} aria-hidden="true" />{t.share}</button>
        <div className="button-row">
          <button type="button" className="button button-quiet" onClick={copy}>{copied ? <Check size={20} aria-hidden="true" /> : <Copy size={20} aria-hidden="true" />}{copied ? t.copied : t.copyLink}</button>
          <button type="button" className="button button-quiet" onClick={() => window.print()}><Printer size={20} aria-hidden="true" />{t.print}</button>
        </div>
      </div>
    </div>
  )
}
