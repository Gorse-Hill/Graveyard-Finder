import { useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { Camera, CameraOff } from 'lucide-react'
import { parseQrInput } from '../lib/domain'
import { t } from '../lib/strings'

export default function QrScanner({ onToken }: { onToken: (token: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [active, setActive] = useState(false)
  const [message, setMessage] = useState('')
  const lastValue = useRef('')

  const stop = () => {
    controlsRef.current?.stop()
    controlsRef.current = null
    setActive(false)
  }

  useEffect(() => () => controlsRef.current?.stop(), [])

  const start = async () => {
    if (!videoRef.current) return
    setMessage('')
    try {
      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 250,
        delayBetweenScanSuccess: 750,
      })
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        videoRef.current,
        (result) => {
          if (!result) return
          const raw = result.getText()
          if (raw === lastValue.current) return
          lastValue.current = raw
          const token = parseQrInput(raw)
          if (token) {
            stop()
            onToken(token)
          } else {
            setMessage(t.invalidQr)
          }
        },
      )
      controlsRef.current = controls
      setActive(true)
    } catch {
      setMessage(t.cameraError)
      setActive(false)
    }
  }

  return (
    <section className="scanner-block" aria-label={t.scan}>
      <div className={`scanner-frame ${active ? 'is-active' : ''}`}>
        <video ref={videoRef} muted playsInline aria-label={t.scanHelp} />
        {!active && <Camera size={46} aria-hidden="true" className="scanner-placeholder-icon" />}
        {active && <div className="scan-reticle" aria-hidden="true" />}
      </div>
      <p className="scanner-help">{t.scanHelp}</p>
      {message && <p className="field-error" role="alert">{message}</p>}
      <button type="button" className="button button-secondary" onClick={active ? stop : start}>
        {active ? <CameraOff size={22} aria-hidden="true" /> : <Camera size={22} aria-hidden="true" />}
        {active ? t.stopCamera : t.startCamera}
      </button>
    </section>
  )
}
