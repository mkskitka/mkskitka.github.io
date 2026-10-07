import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { projects } from '../data/projects.js'

/**
 * Scattered tiles, used for Systems (projects; click opens the project view) and
 * Visuals (`items` + `external`: each tile links out in a new tab).
 * One single-cell square per item, scattered over random
 * backdrop grid cells beside the menu panel (never overlapping, always on the
 * lines, chosen once per page load). Hovering a tile grows it to a 2x2 block,
 * expanding away from the nearest page edge so it stays on screen; the other
 * tiles dim. Clicking opens the project (`onSelect(project, event)`).
 *
 * Phones get a plain three-column grid instead (CSS).
 *
 * Thumbnails come from src/data/projects.js (`thumb`): an image, a gif, or a
 * looping muted video.
 */
const PAD = 1 // empty cells kept around every tile (1 leaves room for the 2x2 hover)

const mulberry32 = (a) => () => {
  a |= 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export default function ProjectThumbs({ open = false, onSelect, items = projects, label = 'Projects', external = false }) {
  const nav = useRef(null)
  const seed = useRef(Math.floor(Math.random() * 1e9))
  const [spots, setSpots] = useState(null) // per project: { x, y, s, dx, dy } in px, or null on phones

  // Lay the tiles out on the grid. Re-run on resize and whenever the grid spacing changes.
  useLayoutEffect(() => {
    const el = nav.current
    const section = el?.closest('.section')
    if (!el || !section) return undefined

    const layout = () => {
      if (!window.matchMedia('(min-width: 768px)').matches) {
        setSpots(null)
        return
      }
      const s = parseFloat(getComputedStyle(section).getPropertyValue('--grid-spacing')) || 64
      const W = section.clientWidth
      const H = section.clientHeight
      const L = (k) => s / 2 + k * s // position of grid line k
      const panel = section.querySelector('.header.margin-bottom_none')?.getBoundingClientRect()
      const secRect = section.getBoundingClientRect()
      const panelRight = panel ? panel.right - secRect.left : 0
      const firstCol = Math.ceil((panelRight - s / 2) / s) + 1 // one clear column after the panel
      const cols = Math.floor((W - s / 2) / s)
      const rows = Math.floor((H - s / 2) / s)
      const rnd = mulberry32(seed.current)
      const used = new Set()
      const out = items.map(() => {
        for (let tries = 0; tries < 500; tries++) {
          const i = firstCol + Math.floor(rnd() * Math.max(1, cols - firstCol))
          const j = Math.floor(rnd() * Math.max(1, rows))
          let ok = i < cols && j < rows
          for (let a = -PAD; a <= PAD && ok; a++)
            for (let b = -PAD; b <= PAD && ok; b++) if (used.has(`${i + a},${j + b}`)) ok = false
          if (!ok) continue
          used.add(`${i},${j}`)
          // Grow toward the page centre so the 2x2 never leaves the screen.
          const dx = i + 2 <= cols ? 0 : -s
          const dy = j + 2 <= rows ? 0 : -s
          return { x: L(i), y: L(j), s, dx, dy }
        }
        return null
      })
      setSpots(out)
    }

    layout()
    const ro = new ResizeObserver(layout)
    ro.observe(section)
    const mo = new MutationObserver(layout) // --grid-spacing is set as an inline style by the backdrop
    mo.observe(section, { attributes: true, attributeFilter: ['style'] })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [items.length])

  const scatter = Array.isArray(spots)
  return (
    <nav
      ref={nav}
      className={`project_thumbs${scatter ? ' project_thumbs--scatter' : ''}${open ? ' is-open' : ''}`}
      aria-label={label}
      aria-hidden={!open}
    >
      {items.map((p, i) => {
        const spot = scatter ? spots[i] : null
        if (scatter && !spot) return null
        const style = spot
          ? { '--i': i, '--x': `${spot.x}px`, '--y': `${spot.y}px`, '--s': `${spot.s}px`, '--dx': `${spot.dx}px`, '--dy': `${spot.dy}px` }
          : { '--i': i }
        return (
          <a
            key={p.slug ?? p.id}
            href={external ? p.url : `/projects/${p.slug}`}
            target={external ? '_blank' : undefined}
            rel={external ? 'noreferrer' : undefined}
            className="project_thumb"
            style={style}
            tabIndex={open ? 0 : -1}
            onClick={(e) => {
              if (external || !onSelect) return
              e.preventDefault()
              onSelect(p, e)
            }}
          >
            <span className="project_thumb_media">
              {p.thumb?.video ? (
                <video autoPlay muted loop playsInline preload="metadata" poster={p.thumb.video.poster}>
                  {p.thumb.video.webm && <source src={p.thumb.video.webm} type="video/webm" />}
                  {p.thumb.video.mp4 && <source src={p.thumb.video.mp4} type="video/mp4" />}
                </video>
              ) : p.thumb?.image || p.image ? (
                <img src={p.thumb?.image || p.image} alt="" loading="lazy" />
              ) : null}
            </span>
            <span className="project_thumb_title">{p.title}</span>
          </a>
        )
      })}
    </nav>
  )
}
