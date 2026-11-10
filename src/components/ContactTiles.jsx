import { useLayoutEffect, useRef } from 'react'
import { contactLinks } from '../data/contact.js'
import { contactIcons } from './contactIcons.jsx'
import { usePhoneSpots } from '../lib/phoneTiles.js'

/**
 * The Contact grid: one tile per contact link (Instagram, email, GitHub), shown
 * beside the hero menu when CONTACT is selected. Same grid as the Systems tiles
 * (components/ProjectThumbs.jsx) but every tile is a 2x2 block of backdrop cells,
 * with the icon in the middle and the handle along the bottom.
 * Phones: 3x3-cell blocks, two per row under the panel, placed on the grid by
 * lib/phoneTiles.js (--x/--y/--s per tile) so they always fit the screen.
 */
export default function ContactTiles({ open = false }) {
  const nav = useRef(null)
  // Phones: two tiles per row, filled left to right (an odd one out centred on its own
  // row), each row centred to the nearest cell so every tile stays on the columns. A
  // screen too short for two rows of 3x3 tiles gets them all in one row instead.
  const spots = usePhoneSpots(nav, contactLinks.length, { cells: 3, scatter: false, centered: true, columns: 2 })
  const scatter = Array.isArray(spots)
  // Desktop: the row of tiles is centred in the space beside the menu panel, on the
  // grid: the same number of clear columns between the panel and the first tile as
  // between the last tile and the right edge, and the row on the page's middle rows.
  useLayoutEffect(() => {
    const el = nav.current
    const section = el?.closest('.section')
    if (!el || !section) return undefined
    const place = () => {
      if (!window.matchMedia('(min-width: 768px)').matches) {
        el.style.marginLeft = ''
        el.style.marginTop = ''
        return
      }
      const cs = getComputedStyle(section)
      const s = parseFloat(cs.getPropertyValue('--grid-spacing')) || 64
      const sy = parseFloat(cs.getPropertyValue('--grid-spacing-y')) || s
      const ox = parseFloat(cs.getPropertyValue('--grid-origin-x')) || 0
      const oy = parseFloat(cs.getPropertyValue('--grid-origin-y')) || 0
      const cells = parseFloat(cs.getPropertyValue('--thumb-cells')) || 2
      const gapCells = parseFloat(cs.getPropertyValue('--thumb-gap-cells')) || 1
      const secRect = section.getBoundingClientRect()
      const panel = section.querySelector('.header.margin-bottom_none')?.getBoundingClientRect()
      const panelRight = panel ? panel.right - secRect.left : 0
      const lastLine = ox + Math.floor((secRect.width - ox) / s + 1e-6) * s
      const free = Math.round((lastLine - panelRight) / s) // whole columns beside the panel
      const block = contactLinks.length * cells + (contactLinks.length - 1) * gapCells
      const gap = Math.max(gapCells, Math.floor((free - block) / 2))
      el.style.marginLeft = `${gap * s}px`
      const rows = Math.floor((secRect.height - oy) / sy + 1e-6)
      const top = oy + Math.max(0, Math.floor((rows - cells) / 2)) * sy
      const padTop = parseFloat(cs.paddingTop) || 0 // the section's own top padding, as the panel's --hero-panel-top allows for
      el.style.marginTop = `${top - padTop}px`
    }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(section)
    const mo = new MutationObserver(place)
    mo.observe(section, { attributes: true, attributeFilter: ['style'] })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [])
  return (
    <nav
      ref={nav}
      className={`project_thumbs contact_tiles${scatter ? ' project_thumbs--scatter' : ''}${open ? ' is-open' : ''}`}
      aria-label="Contact"
      aria-hidden={!open}
    >
      {contactLinks.map((c, i) => {
        const external = !c.url.startsWith('mailto:')
        const spot = scatter ? spots[i] : null
        if (scatter && !spot) return null
        return (
          <a
            key={c.id}
            href={c.url}
            className="project_thumb contact_tile"
            style={
              spot
                ? {
                    '--i': i,
                    '--x': `${spot.x}px`,
                    '--y': `${spot.y}px`,
                    '--s': `${spot.s}px`,
                    '--sh': `${spot.sh ?? spot.s}px`,
                  }
                : { '--i': i }
            }
            tabIndex={open ? 0 : -1}
            target={external ? '_blank' : undefined}
            rel={external ? 'noreferrer' : undefined}
          >
            <span className="contact_tile_icon">{contactIcons[c.id]}</span>
            <span className="contact_tile_label">
              <span className="contact_tile_name">{c.label}</span>
              <span className="contact_tile_handle">{c.handle}</span>
            </span>
          </a>
        )
      })}
    </nav>
  )
}
