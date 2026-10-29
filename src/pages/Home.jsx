import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { projects } from '../data/projects.js'
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
// Every state of the page has its own address, so the link in the address bar can be
// copied and sent, and the browser's back / forward buttons step between them:
//   /            nothing open          /about             the bio
//   /systems     the project tiles     /projects/<slug>   that project open
//   /visuals     the visuals tiles     /visuals/<id>      that visual open
//   /contact     the contact tiles
// (<slug> and <id> are from src/data/projects.js and src/data/visuals.js.) The old
// /#systems style still works and is turned into /systems.
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

// An open visual: swipe left / right (or the arrow keys) for the next / previous one.
const VISUAL_SWIPE = 50 // px a finger must travel sideways to count as a swipe

const MENU = [
  { id: 'home', label: 'MK SKITKA', path: '/about' },
  { id: 'systems', label: 'SYSTEMS', path: '/systems' },
  { id: 'visuals', label: 'VISUALS', path: '/visuals' },
  { id: 'contact', label: 'CONTACT', path: '/contact' },
]
// The address for a state of the page, and the state an address asks for.
const pathFor = (active, project) =>
  project ? (project.kind === 'visual' ? `/visuals/${project.slug}` : `/projects/${project.slug}`) : (MENU.find((m) => m.id === active)?.path ?? '/')
const parsePath = (pathname) => {
  const menu = MENU.find((m) => m.path === pathname.replace(/\/$/, '') || m.path === pathname)
  if (menu) return { active: menu.id }
  const proj = pathname.match(/^\/projects\/([^/]+)\/?$/)
  if (proj) return { active: 'systems', item: projects.find((p) => p.slug === decodeURIComponent(proj[1])) ?? false }
  const vis = pathname.match(/^\/visuals\/([^/]+)\/?$/)
  if (vis) return { active: 'visuals', item: VISUAL_ITEMS.find((v) => v.slug === decodeURIComponent(vis[1])) ?? false }
  return { active: null }
}

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
  const location = useLocation()
  const navigate = useNavigate()
  // What is selected in the menu (the address decides; see pathFor / parsePath above).
  const [active, setActive] = useState(() => parsePath(location.pathname).active)

  // The open project (if any) and the tile rectangle it grew out of.
  const [project, setProject] = useState(null)
  const [projectFrom, setProjectFrom] = useState(null)
  const [backdropMounted, setBackdropMounted] = useState(false)
  const [backdropKey, setBackdropKey] = useState(0) // bumped per opened image, so each one plays its own reveal
  // The visual reached by swiping (its index), so the tiles can follow to its screen.
  const [visualAt, setVisualAt] = useState(null)
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
      if (project) closeProject() // back to the tiles first
      else {
        setActive(null)
        navigate('/')
      }
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
      closeProject() // first click while a project or visual is open: back to its tiles
      if (id === active) return
    }
    const next = active === id ? null : id
    setActive(next)
    navigate(pathFor(next, null))
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
    setBackdropKey((k) => k + 1)
    setVisualAt(null)
    const to = pathFor(p.kind === 'visual' ? 'visuals' : 'systems', p)
    if (location.pathname !== to) navigate(to)
  }

  // Back to the tiles (and to their address).
  const closeProject = () => {
    setProject(null)
    navigate(pathFor(active, null))
  }

  // The address changed under us (a sent link on arrival, or the browser's back / forward
  // buttons): bring the page to the state it names. A project with a password asks for it
  // first; an address that names nothing known goes home. /#systems etc. is the old form.
  useEffect(() => {
    const hash = location.hash.slice(1)
    if (location.pathname === '/' && MENU.some((m) => m.id === hash)) return navigate(pathFor(hash, null), { replace: true })
    const want = parsePath(location.pathname)
    if (want.item === false) return navigate('/', { replace: true })
    if (want.active !== active) setActive(want.active)
    if (want.item) {
      if (project?.slug !== want.item.slug && locked?.project.slug !== want.item.slug) openProject(want.item)
    } else if (project || locked) {
      setProject(null)
      setLocked(null)
    }
  }, [location]) // eslint-disable-line react-hooks/exhaustive-deps

  // The tab's title names what is open (it is what a sent link shows as its title).
  useEffect(() => {
    const what = project?.title ?? MENU.find((m) => m.id === active)?.label
    document.title = what && active !== 'home' ? `${what} — MK Skitka` : 'MK Skitka'
  }, [active, project])

  // An open visual: step to the next (1) or previous (-1) one. Its image is revealed
  // from the side it comes in from. Stops at the first and last.
  const visualIndex = isVisual ? VISUAL_ITEMS.findIndex((v) => v.slug === project.slug) : -1
  const stepVisual = (dir) => {
    const next = VISUAL_ITEMS[visualIndex + dir]
    const host = heroRef.current
    if (visualIndex < 0 || !next || !host) return
    setProjectFrom({ left: dir > 0 ? host.clientWidth : 0, top: host.clientHeight / 2, width: 0, height: 0 })
    setProject(next)
    setBackdropKey((k) => k + 1)
    setVisualAt(visualIndex + dir)
    navigate(pathFor('visuals', next), { replace: true })
  }
  const stepRef = useRef(stepVisual)
  stepRef.current = stepVisual

  useEffect(() => {
    if (visualIndex < 0) return undefined
    // Have the neighbours' images ready, so a swipe shows the next one straight away.
    for (const d of [-1, 1]) {
      const src = VISUAL_ITEMS[visualIndex + d]?.thumb?.image
      if (src) new Image().src = src
    }
    let touch = null
    const onStart = (e) => {
      const t = e.touches[0]
      touch = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null
    }
    const onEnd = (e) => {
      if (!touch) return
      const t = e.changedTouches[0]
      const dx = t.clientX - touch.x
      const dy = t.clientY - touch.y
      touch = null
      if (Math.abs(dx) >= VISUAL_SWIPE && Math.abs(dx) > Math.abs(dy)) stepRef.current(dx < 0 ? 1 : -1)
    }
    const onKey = (e) => {
      if (e.key === 'ArrowRight') stepRef.current(1)
      else if (e.key === 'ArrowLeft') stepRef.current(-1)
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('keydown', onKey)
    }
  }, [visualIndex])

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
                key={backdropKey}
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
                  closeProject()
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
        <ProjectThumbs open={active === 'systems' && !project} keep={active === 'systems' && !!project} onSelect={openProject} />
        <ProjectThumbs open={active === 'visuals' && !project} keep={active === 'visuals' && !!project} focus={visualAt} items={VISUAL_ITEMS} label="Visuals" onSelect={openProject} bounce={visualsFresh} titles={SHOW_VISUAL_TITLES} />
        <ContactTiles open={active === 'contact'} />
        {/* MK SKITKA: the bio (src/data/about.js). A project: its write-up (src/data/projects.js). */}
        <WriteUp open={active === 'home' && !project} heading={about.heading} paragraphs={about.paragraphs} align="center">
          <Link to="/resume" className="writeup_link">
            Resume -&gt;
          </Link>
        </WriteUp>
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
      <ProjectLock
        project={locked?.project}
        onUnlock={() => show(locked.project, locked.from)}
        onCancel={() => {
          setLocked(null)
          navigate('/systems', { replace: true }) // declined: back to the tiles (and their address)
        }}
      />
    </div>
  )
}
