import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'

// Only the hero page is live right now. The project pages still exist in
// src/pages/Project.jsx; to bring them back add:
//   <Route path="/projects/:slug" element={<Project />} />
export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
