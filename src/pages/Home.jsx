import { useEffect, useRef, useState } from 'react'
import HeroBackdrop from '../components/HeroBackdrop.jsx'
import ProjectThumbs from '../components/ProjectThumbs.jsx'
import ContactTiles from '../components/ContactTiles.jsx'
import { visuals } from '../data/visuals.js'
import { about } from '../data/about.js'
import WriteUp from '../components/WriteUp.jsx'
import ProjectBackdrop from '../components/ProjectBackdrop.jsx'
import { sampleGridPalette } from '../lib/imagePalette.js'
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
// Visuals shaped like projects, so a tile opens with the same full-page reveal
// (components/ProjectBackdrop.jsx) and the same title panel. `url` stays in the data.
const VISUAL_ITEMS = visuals.map((v) => ({ ...v, slug: v.id, heading: [v.title], thumb: { image: v.image } }))

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

  // The open project (if any) and the tile rectangle it grew out of.
  const [project, setProject] = useState(null)
  const [projectFrom, setProjectFrom] = useState(null)
  const [backdropMounted, setBackdropMounted] = useState(false)
  const [palette, setPalette] = useState(null) // grid line colours sampled from the open project's image
  const heroRef = useRef(null)

  // When a project opens, sample its image for the grid colours; on close, go back.
  useEffect(() => {
    if (!project) {
      setPalette(null)
      return undefined
    }
    let alive = true
    const url = project.hero?.still || project.hero?.video?.poster || project.thumb?.image || null
    sampleGridPalette(url).then((p) => alive && setPalette(p))
    return () => {
      alive = false
    }
  }, [project])

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

  const pick = (id) => (e) => {
    e.preventDefault()
    if (project) {
      setProject(null) // first click while a project or visual is open: back to its tiles
      if (id === active) return
    }
    setActive((cur) => (cur === id ? null : id))
  }

  const openProject = (p, e) => {
    const r = e?.currentTarget?.getBoundingClientRect()
    const host = heroRef.current?.getBoundingClientRect()
    setProjectFrom(r && host ? { left: r.left - host.left, top: r.top - host.top, width: r.width, height: r.height } : null)
    setProject(p)
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
          transparent={!!project}
          palette={palette}
          behind={
            backdropMounted ? (
              <ProjectBackdrop
                project={project}
                from={projectFrom}
                host={heroRef}
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
              {(project.heading ?? [project.title]).map((line) => (
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
        <ProjectThumbs open={active === 'visuals' && !project} items={VISUAL_ITEMS} label="Visuals" onSelect={openProject} />
        <ContactTiles open={active === 'contact'} />
        {/* MK SKITKA: the bio (src/data/about.js). A project: its write-up (src/data/projects.js). */}
        <WriteUp open={active === 'home' && !project} heading={about.heading} paragraphs={about.paragraphs} />
        <WriteUp
          open={!!project}
          heading={project?.title}
          lines={[
            { label: 'Date', value: project?.date },
            { label: 'Role', value: project?.role },
            { label: 'Mediums', value: project?.mediums },
          ]}
          paragraphs={project?.description ? [].concat(project.description) : ['Project write-up coming soon. Add it as `description` in src/data/projects.js (a string or a list of paragraphs).']}
        />
      </header>
    </div>
  )
}
