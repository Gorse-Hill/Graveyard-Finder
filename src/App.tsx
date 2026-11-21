import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import Layout from './components/Layout'
import HomePage from './pages/Home'
import { t } from './lib/strings'

const SaveGravePage = lazy(() => import('./pages/SaveGrave'))
const FamilyCardPage = lazy(() => import('./pages/FamilyCard'))
const FindMemorialPage = lazy(() => import('./pages/FindMemorial'))
const FamilyViewPage = lazy(() => import('./pages/FamilyView'))
const CaretakerSignInPage = lazy(() => import('./pages/CaretakerSignIn'))
const CaretakerReportPage = lazy(() => import('./pages/CaretakerReport'))
const QueuePage = lazy(() => import('./pages/Queue'))
const AdminPage = lazy(() => import('./pages/Admin'))
const NotFoundPage = lazy(() => import('./pages/NotFound'))

export default function App() {
  return (
    <Suspense fallback={<div className="page-container"><p className="loading-line">{t.openingPage}</p></div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/save" element={<SaveGravePage />} />
          <Route path="/card/:id" element={<FamilyCardPage />} />
          <Route path="/find" element={<FindMemorialPage />} />
          <Route path="/g/:token" element={<FamilyViewPage />} />
          <Route path="/caretaker/sign-in" element={<CaretakerSignInPage />} />
          <Route path="/caretaker/report" element={<CaretakerReportPage />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
