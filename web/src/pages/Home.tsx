import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Camera, HeartHandshake, MapPin, QrCode } from 'lucide-react'
import { listGraves, waitingCount } from '../lib/db'
import type { Grave } from '../types'
import { locationInWords } from '../lib/domain'
import { isInstalledApp, isIosDevice, isTvBrowser } from '../lib/device'
import { requestPersistentStorage } from '../lib/storage'
import { Notice } from '../components/PageHeader'
import { t } from '../lib/strings'

export default function HomePage() {
  const [graves, setGraves] = useState<Grave[]>([])
  const [waiting, setWaiting] = useState(0)
  const [atRisk, setAtRisk] = useState(false)
  const tv = isTvBrowser()
  useEffect(() => {
    void listGraves().then(setGraves)
    void waitingCount().then(setWaiting)
    if (!tv && !isInstalledApp()) void requestPersistentStorage().then((kept) => setAtRisk(!kept))
  }, [tv])

  return (
    <div className="home-page">
      <section className="home-intro">
        <div className="brand-lockup">
          <div className="brand-logos">
            <img src="./ag-tech.webp" alt={t.agTechLogoAlt} className="ag-tech-logo" />
            <img src="./ahmed-gorse-waqaf.webp" alt={t.logoAlt} className="waqaf-logo" />
          </div>
          <div className="brand-credit">
            <p className="brand-attribution">{t.brandAttribution}</p>
            <p className="credit-line">{t.credit}</p>
          </div>
        </div>
        <div className="home-purpose">
          <p className="overline">{t.appName}</p>
          <h1>{t.shortTagline}</h1>
          <p>{t.saveGraveIntro}</p>
          <Link to="/queue" className={`waiting-summary ${waiting ? 'has-waiting' : ''}`}>
            <span className="status-dot" aria-hidden="true" />
            <strong>{waiting}</strong> {waiting === 1 ? t.waitingOne : t.waitingMany}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="task-panel" aria-label={t.mainTasks}>
        {atRisk && graves.length > 0 && <Notice tone="warning">{t.storageWarning}{isIosDevice() ? ` ${t.iosInstallHint}` : ''}</Notice>}
        {!tv && <Link to="/save" className="task-link task-primary">
          <span className="task-icon"><Camera size={28} aria-hidden="true" /></span>
          <span><strong>{t.saveGrave}</strong><small>{t.saveGraveIntro}</small></span>
          <ArrowRight size={26} aria-hidden="true" />
        </Link>}
        <Link to="/find" className="task-link task-primary">
          <span className="task-icon"><QrCode size={27} aria-hidden="true" /></span>
          <span><strong>{t.findMemorial}</strong><small>{t.findIntro}</small></span>
          <ArrowRight size={24} aria-hidden="true" />
        </Link>
        {!tv && <Link to="/caretaker/sign-in" className="task-link">
          <span className="task-icon"><HeartHandshake size={27} aria-hidden="true" /></span>
          <span><strong>{t.caretakerVisit}</strong><small>{t.reportIntro}</small></span>
          <ArrowRight size={24} aria-hidden="true" />
        </Link>}
        <p className="privacy-note">{tv ? t.tvPhoneHint : t.privateOffline}</p>
      </section>

      {graves.length > 0 && (
        <section className="local-records" aria-labelledby="local-records-title">
          <div className="section-title-row">
            <h2 id="local-records-title">{t.savedOnDevice}</h2>
            <span>{graves.length}</span>
          </div>
          <div className="record-list">
            {graves.map((grave) => (
              <Link to={`/card/${grave.id}`} className="record-row" key={grave.id}>
                <MapPin size={22} aria-hidden="true" />
                <span><strong>{grave.name}</strong><small>{locationInWords(grave)}</small></span>
                <ArrowRight size={20} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
