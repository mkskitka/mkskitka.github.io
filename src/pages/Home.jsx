import { useEffect, useRef, useState } from 'react'
import HeroBackdrop from '../components/HeroBackdrop.jsx'
import ProjectThumbs from '../components/ProjectThumbs.jsx'
import ContactTiles from '../components/ContactTiles.jsx'
import { visuals } from '../data/visuals.js'
import { about } from '../data/about.js'
import WriteUp from '../components/WriteUp.jsx'
import ProjectGallery from '../components/ProjectGallery.jsx'
import ProjectBackdrop from '../components/ProjectBackdrop.jsx'
import ProjectLock, { isUnlocked } from '../components/ProjectLock.jsx'
import { revealSections } from '../lib/animations.js'

// The site is currently just the hero, fixed to one screen with no scrolling: wheel,
// touch and keys drive the backdrop animation instead (GridInkBackdrop SETTINGS.scroll).
// The earlier sections (Intro, Systems wheel, Contact) and the project pages are kept
// in src/ for reference; see src/pages/Home.full.jsx for the previous full home page.
//
// The hero menu: clicking SYSTEMS selects it (the other links go translucent) and
// opens the grid of project thumbnails beside the panel (components/ProjectThumbs.jsx);
// VISUALS opens the same scattered tiles for the visuals (src/data/visuals.js), and a
// visual tile expands to fill the page exactly like a project tile does;
// CONTACT opens the contact tiles in the same grid (components/ContactTiles.jsx);
// MK SKITKA opens the bio write-up, and an open project shows its own (components/WriteUp.jsx).
// Clicking a project tile expands its image from the tile to fill the page behind
// the grid lines (components/ProjectBackdrop.jsx); Escape or SYSTEMS brings the
// tiles back.
// Clicking it again, clicking another link, or pressing Escape closes it.
// /#systems opens the page with the grid already showing.
// Clicking SYSTEMS (to open it) sends a band of light along the grid lines, left to right;
// clicking VISUALS pours a stream of ink/smoke into the backdrop (GridInkBackdrop SETTINGS.glow / .pour).
// Only those menu clicks do it: coming back to the tiles from a project or visual does not.
// Visuals shaped like projects, so a tile opens with the same full-page reveal
// (components/ProjectBackdrop.jsx) and the same title panel. `url` stays in the data.
const VISUAL_ITEMS = visuals.map((v) => ({ ...v, kind: 'visual', slug: v.id, heading: [v.title], thumb: { image: v.image } }))

// Grid line colour while something is open: white over a project, black over a visual.
// (src/lib/imagePalette.js can pick the contrasting one from the image instead, if you
// would rather it chose automatically.)
// color is [r, g, b] 0..255; opacity 0..1 (1 solid, 0 invisible).
const LINE_ON_PROJECT = { color: [245, 245, 248], opacity: 0.3 }
const LINE_ON_VISUAL = { color: [245, 245, 248], opacity: 0.3}
const LINE_OPACITY_HOME = 1 // the site's own grid, nothing open
const flatPalette = (c) => ({ hFrom: c, hTo: c, vFrom: c, vTo: c })

// Visuals: show each piece's title (on its tile when hovered, and in the panel when it
// is open)? false = no titles anywhere, just the back arrow when one is open.
const SHOW_VISUAL_TITLES = false

const MENU = [
  { id: 'home', label: 'MK SKITKA' },
  { id: 'systems', label: 'SYSTEMS' },
  { id: 'visuals', label: 'VISUALS' },
  { id: 'contact', label: 'CONTACT' },
]

// Phones skip the full-page project image: the write-up and gallery carry the
// project there, and a huge backdrop behind them is heavy and hard to read.
const PHONE_QUERY = '(max-width: 767px)'

export default function Home() {
  const root = useRef(null)
  const [isPhone, setIsPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY)
    const onChange = (e) => setIsPhone(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  // Opening the page at /#systems starts with the Systems grid open.
  const [active, setActive] = useState(() =>
    MENU.some((m) => `#${m.id}` === window.location.hash) ? window.location.hash.slice(1) : null,
  )

  // The open project (if any) and the tile rectangle it grew out of.
  const [project, setProject] = useState(null)
  const [projectFrom, setProjectFrom] = useState(null)
  const [backdropMounted, setBackdropMounted] = useState(false)
  const [palette, setPalette] = useState(null) // grid line colours sampled from the open project's image
  const heroRef = useRef(null)

  // Flat line colour while a project or visual is open; back to the site palette on close.
  useEffect(() => {
    if (!project || (isPhone && project.kind !== 'visual')) setPalette(null)
    else setPalette(flatPalette((project.kind === 'visual' ? LINE_ON_VISUAL : LINE_ON_PROJECT).color))
  }, [project, isPhone])

  useEffect(() => revealSections(root.current), [])

  useEffect(() => {
    if (!active) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (project) setProject(null) // back to the tiles first
      else setActive(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, project])

  // Bumped by a menu click that opens Systems / Visuals; each bump plays the effect once.
  const [glowCount, setGlowCount] = useState(0)
  const [pourCount, setPourCount] = useState(0)
  // The Visuals bounce (lines and tiles) plays when VISUALS is picked from the menu, not
  // when coming back to the tiles from an open visual.
  const [visualsFresh, setVisualsFresh] = useState(false)

  const pick = (id) => (e) => {
    e.preventDefault()
    if (id !== active) {
      if (id === 'systems') setGlowCount((n) => n + 1)
      if (id === 'visuals') {
        setPourCount((n) => n + 1)
        setVisualsFresh(true)
      }
    }
    if (project) {
      setProject(null) // first click while a project or visual is open: back to its tiles
      if (id === active) return
    }
    setActive((cur) => (cur === id ? null : id))
  }

  // Visuals are shown as the piece itself: the whole image as large as it fits, no
  // write-up, just the back arrow and its title. Projects keep the write-up, and on
  // phones they show no full-page image at all.
  const isVisual = project?.kind === 'visual'
  const showBackdrop = !!project && (isVisual || !isPhone)

  // A locked project (`lock` in src/data/projects.js) waiting for its password, with
  // the tile rectangle it will grow out of once unlocked (components/ProjectLock.jsx).
  const [locked, setLocked] = useState(null)

  const openProject = (p, e) => {
    const r = e?.currentTarget?.getBoundingClientRect()
    const host = heroRef.current?.getBoundingClientRect()
    const from = r && host ? { left: r.left - host.left, top: r.top - host.top, width: r.width, height: r.height } : null
    if (!isUnlocked(p)) return setLocked({ project: p, from })
    show(p, from)
  }

  const show = (p, from) => {
    setLocked(null)
    setProjectFrom(from)
    setProject(p)
    setVisualsFresh(false)
    setBackdropMounted(true)
  }

  return (
    <div ref={root} className="home home--fixed">
      {/* Full-screen hero with site menu */}
      <header
        ref={heroRef}
        className={`section is-full-screen${active ? ' has-selection' : ''}${project ? ' has-project' : ''}`}
      >
        <HeroBackdrop
          nodeId="w-node-cdbde5e8-8b4f-e20c-bac0-1a4bbfefe3c5-bfefe3c3"
          nodeClass="w-node-f99f2480-672f-65d5-b6b3-accc741875a0-d8033e09"
          sketch
          transparent={showBackdrop}
          palette={palette}
          glow={glowCount}
          pour={pourCount}
          bounce={active === 'visuals' && !project && visualsFresh}
          trace={active === 'contact'}
          lineOpacity={palette ? (isVisual ? LINE_ON_VISUAL : LINE_ON_PROJECT).opacity : LINE_OPACITY_HOME}
          behind={
            backdropMounted && (isVisual || !isPhone) ? (
              <ProjectBackdrop
                project={project}
                from={projectFrom}
                host={heroRef}
                fit={isVisual ? 'contain' : 'cover'}
                onClosed={() => setBackdropMounted(false)}
              />
            ) : null
          }
        />
        <div className="header margin-bottom_none">
          {project ? (
            <>
              {/* Project view: back arrow + the project's title lines (as on the old project page) */}
              <a
                href="#"
                className="heading_primary hero_menu_text_color project_back"
                aria-label="Back to projects"
                onClick={(e) => {
                  e.preventDefault()
                  setProject(null)
                }}
              >
                &lt;-
              </a>
              {/* Visuals show no title for now (SHOW_VISUAL_TITLES above). */}
              {(isVisual && !SHOW_VISUAL_TITLES ? [] : (project.heading ?? [project.title])).map((line) => (
                <span key={line} className="heading_primary hero_menu_text_color is-active project_title_line">
                  {line}
                </span>
              ))}
            </>
          ) : (
            MENU.map((m) => (
              <a
                key={m.id}
                href="#"
                className={`heading_primary hero_menu_text_color${active === m.id ? ' is-active' : ''}`}
                aria-pressed={active === m.id}
                onClick={pick(m.id)}
              >
                {m.label}
              </a>
            ))
          )}
        </div>
        <ProjectThumbs open={active === 'systems' && !project} onSelect={openProject} />
        <ProjectThumbs open={active === 'visuals' && !project} items={VISUAL_ITEMS} label="Visuals" onSelect={openProject} bounce={visualsFresh} titles={SHOW_VISUAL_TITLES} />
        <ContactTiles open={active === 'contact'} />
        {/* MK SKITKA: the bio (src/data/about.js). A project: its write-up (src/data/projects.js). */}
        <WriteUp open={active === 'home' && !project} heading={about.heading} paragraphs={about.paragraphs} align="center" />
        <WriteUp
          open={!!project && !isVisual}
          align="right"
          heading={project?.title}
          lines={[
            { label: 'Date', value: project?.date },
            { label: 'Role', value: project?.role },
            { label: 'Mediums', value: project?.mediums },
          ]}
          paragraphs={[].concat(project?.description ?? []).filter(Boolean).length ? [].concat(project.description).filter(Boolean) : ['Project write-up coming soon. Add it as `description` in src/data/projects.js (a string or a list of paragraphs).']}
        >
          {project && <ProjectGallery images={project.gallery ?? []} />}
        </WriteUp>
      </header>
      <ProjectLock project={locked?.project} onUnlock={() => show(locked.project, locked.from)} onCancel={() => setLocked(null)} />
    </div>
  )
}
