import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * NOT MOUNTED at the moment (see src/App.jsx): the tab icon is public/favicon.svg, the
 * backdrop's lines, on every address. What this did when mounted:
 *
 * The browser-tab icon follows the address: each section has one of the pixel
 * sprites from the logo (public/icons/<name>.svg; public/favicon.svg is the home
 * one, for the first paint and for browsers that never swap). Safari keeps the icon
 * it loaded with the page, so there the home one stays.
 */
const ICON = (pathname) => {
  if (pathname.startsWith('/systems') || pathname.startsWith('/projects/')) return 'systems'
  if (pathname.startsWith('/visuals')) return 'visuals'
  if (pathname.startsWith('/contact')) return 'contact'
  if (pathname.startsWith('/resume')) return 'resume'
  return 'home'
}

export default function RouteFavicon() {
  const { pathname } = useLocation()
  useEffect(() => {
    const href = `/icons/${ICON(pathname)}.svg`
    let link = document.querySelector('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      link.type = 'image/svg+xml'
      document.head.appendChild(link)
    }
    if (link.getAttribute('href') !== href) link.setAttribute('href', href)
  }, [pathname])
  return null
}
