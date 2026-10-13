import { useRef } from 'react'
import { contactLinks } from '../data/contact.js'
import { contactIcons } from './contactIcons.jsx'
import { usePhoneSpots } from '../lib/phoneTiles.js'

/**
 * The Contact grid: one tile per contact link (Instagram, email, GitHub), shown
 * beside the hero menu when CONTACT is selected. Same grid as the Systems tiles
 * (components/ProjectThumbs.jsx) but every tile is a 2x2 block of backdrop cells,
 * with the icon in the middle and the handle along the bottom.
 * Phones: 3x3-cell blocks in a row under the panel, placed on the grid by
 * lib/phoneTiles.js (--x/--y/--s per tile) so they always fit the screen.
 */
export default function ContactTiles({ open = false }) {
  const nav = useRef(null)
  const spots = usePhoneSpots(nav, contactLinks.length, { cells: 3, scatter: false, shuffle: false })
  const scatter = Array.isArray(spots)
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
            style={spot ? { '--i': i, '--x': `${spot.x}px`, '--y': `${spot.y}px`, '--s': `${spot.s}px` } : { '--i': i }}
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
