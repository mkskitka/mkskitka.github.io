import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Resume from './pages/Resume.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'

// Only the hero page is live right now. Every address is that same page with something
// open on it (links you can send; see the top of src/pages/Home.jsx for the list). The
// old separate project pages still exist in src/pages/Project.jsx for reference.
export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<Home />} />
        <Route path="/systems" element={<Home />} />
        <Route path="/visuals" element={<Home />} />
        <Route path="/contact" element={<Home />} />
        <Route path="/projects/:slug" element={<Home />} />
        <Route path="/visuals/:id" element={<Home />} />
        <Route path="/resume" element={<Resume />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
