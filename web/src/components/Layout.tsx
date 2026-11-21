import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Cloud, CloudOff, Home, ListChecks, ShieldCheck } from 'lucide-react'
import { waitingCount } from '../lib/db'
import { syncConfigured } from '../lib/config'
import { syncNow } from '../lib/sync'
import { isTvBrowser } from '../lib/device'
import { installDpad } from '../lib/dpad'
import { t } from '../lib/strings'

export default function Layout() {
  const tv = isTvBrowser()
  const [waiting, setWaiting] = useState(0)
  const [online, setOnline] = useState(navigator.onLine)
  const location = useLocation()

  const refreshQueue = useCallback(async () => {
    setWaiting(await waitingCount())
  }, [])

  useEffect(() => {
    let active = true
    void waitingCount().then((count) => {
      if (active) setWaiting(count)
    })
    return () => { active = false }
  }, [location.pathname])

  useEffect(() => (tv ? installDpad() : undefined), [tv])

  useEffect(() => {
    const onOnline = () => {
      setOnline(true)
      void syncNow().then(refreshQueue)
    }
    const onOffline = () => setOnline(false)
    const onSynced = () => void refreshQueue()
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('graveyard-synced', onSynced)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('graveyard-synced', onSynced)
    }
  }, [refreshQueue])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">{t.skipToContent}</a>
      <header className="topbar">
        <Link to="/" className="wordmark" aria-label={`${t.appName}, ${t.home}`}>
          <span className="wordmark-mark" aria-hidden="true">GF</span>
          <span>{t.appName}</span>
        </Link>
        <nav className="topbar-nav" aria-label={t.mainNavigation}>
          <NavLink to="/" className="nav-icon-link" aria-label={t.home} title={t.home}>
            <Home size={20} aria-hidden="true" /><span>{t.home}</span>
          </NavLink>
          {!tv && <NavLink to="/queue" className="queue-link" aria-label={`${t.queue}, ${waiting} ${t.waiting}`}>
            <ListChecks size={20} aria-hidden="true" />
            <span className="queue-link-label">{t.queue}</span>
            {waiting > 0 && <span className="queue-count">{waiting}</span>}
          </NavLink>}
          {!tv && <NavLink to="/admin" className="nav-icon-link admin-nav" aria-label={t.admin} title={t.admin}>
            <ShieldCheck size={20} aria-hidden="true" /><span>{t.admin}</span>
          </NavLink>}
        </nav>
      </header>
      <div className={`connection-banner ${online ? 'is-online' : 'is-offline'}`} role="status">
        {online ? <Cloud size={16} aria-hidden="true" /> : <CloudOff size={16} aria-hidden="true" />}
        <span>{online ? t.online : t.offline}</span>
        {!syncConfigured && <span className="connection-detail"> · {t.localSave}</span>}
      </div>
      <main id="main-content" className="main-content">
        <Outlet />
      </main>
      <footer className="app-footer">
        <span>{t.appName}</span>
        <span>{t.privateOffline}</span>
      </footer>
    </div>
  )
}
