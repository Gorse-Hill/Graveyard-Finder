import './lib/polyfills'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans/latin-700.css'
import '@fontsource/source-serif-4/latin-400.css'
import '@fontsource/source-serif-4/latin-600.css'
import './index.css'
import App from './App'
import { isTvBrowser } from './lib/device'
import { requestPersistentStorage } from './lib/storage'

if (isTvBrowser()) document.documentElement.dataset.device = 'tv'
void requestPersistentStorage()
try {
  registerSW({ immediate: true })
} catch {
  // Some TV browsers have no service worker. The app still runs online.
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
