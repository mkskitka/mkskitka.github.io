import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Scroll to the top on route change, but honor in-page #anchors.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1))
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
        return
      }
    }
    window.scrollTo(0, 0)
    // Once more after layout settles (pins change the page height on mount).
    const t = setTimeout(() => window.scrollTo(0, 0), 50)
    return () => clearTimeout(t)
  }, [pathname, hash])
  return null
}
