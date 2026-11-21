import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { t } from '../lib/strings'

export default function NotFoundPage() {
  return <div className="page-container narrow-page"><div className="success-state"><p className="overline">404</p><h1>{t.pageNotFound}</h1><Link to="/" className="button button-primary"><ArrowLeft size={22} aria-hidden="true" />{t.home}</Link></div></div>
}
