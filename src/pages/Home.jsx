import { useEffect, useRef, useState } from 'react'
import HeroBackdrop from '../components/HeroBackdrop.jsx'
import ProjectThumbs from '../components/ProjectThumbs.jsx'
import { revealSections } from '../lib/animations.js'

// The site is currently just the hero, fixed to one screen with no scrolling: wheel,
// touch and keys drive the backdrop animation instead (GridInkBackdrop SETTINGS.scroll).
// The earlier sections (Intro, Systems wheel, Contact) and the project pages are kept
// in src/ for reference; see src/pages/Home.full.jsx for the previous full home page.
//
// The hero menu: clicking SYSTEMS selects it (the other links go translucent) and
// opens the grid of project thumbnails beside the panel (components/ProjectThumbs.jsx).
// Clicking it again, clicking another link, or pressing Escape closes it.
// /#systems opens the page with the grid already showing.
const MENU = [
  { id: 'home', label: 'MK SKITKA' },
  { id: 'systems', label: 'SYSTEMS' },
  { id: 'visuals', label: 'VISUALS' },
  { id: 'contact', label: 'CONTACT' },
]

export default function Home() {
  const root = useRef(null)
  // Opening the page at /#systems starts with the Systems grid open.
  const [active, setActive] = useState(() =>
    MENU.some((m) => `#${m.id}` === window.location.hash) ? window.location.hash.slice(1) : null,
  )

  useEffect(() => revealSections(root.current), [])

  useEffect(() => {
    if (!active) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setActive(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  const pick = (id) => (e) => {
    e.preventDefault()
    setActive((cur) => (cur === id ? null : id))
  }

  return (
    <div ref={root} className="home home--fixed">
      {/* Full-screen hero with site menu */}
      <header className={`section is-full-screen${active ? ' has-selection' : ''}`}>
        <HeroBackdrop
          nodeId="w-node-cdbde5e8-8b4f-e20c-bac0-1a4bbfefe3c5-bfefe3c3"
          nodeClass="w-node-f99f2480-672f-65d5-b6b3-accc741875a0-d8033e09"
          sketch
        />
        <div className="header margin-bottom_none">
          {MENU.map((m) => (
            <a
              key={m.id}
              href="#"
              className={`heading_primary hero_menu_text_color${active === m.id ? ' is-active' : ''}`}
              aria-pressed={active === m.id}
              onClick={pick(m.id)}
            >
              {m.label}
            </a>
          ))}
        </div>
        <ProjectThumbs open={active === 'systems'} />
      </header>
    </div>
  )
}
