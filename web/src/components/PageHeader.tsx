import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { t } from '../lib/strings'

export default function PageHeader({ title, intro, backTo = '/' }: {
  title: string
  intro?: string
  backTo?: string
}) {
  return (
    <div className="page-heading">
      <Link to={backTo} className="back-link" aria-label={t.back}>
        <ArrowLeft size={22} aria-hidden="true" /> {t.back}
      </Link>
      <h1>{title}</h1>
      {intro && <p>{intro}</p>}
    </div>
  )
}

export function Notice({ tone = 'info', children }: {
  tone?: 'info' | 'success' | 'warning' | 'error'
  children: ReactNode
}) {
  return <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>
}
