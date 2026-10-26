import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'

// Only the hero page is live right now. /projects/<slug> is the same page with that
// project already open (a link you can send); the old separate project pages still
// exist in src/pages/Project.jsx for reference.
export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/projects/:slug" element={<Home />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
