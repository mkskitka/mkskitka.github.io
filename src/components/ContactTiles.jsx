import { contactLinks } from '../data/contact.js'
import { contactIcons } from './contactIcons.jsx'

/**
 * The Contact grid: one tile per contact link (Instagram, email, GitHub), shown
 * beside the hero menu when CONTACT is selected. Same grid as the Systems tiles
 * (components/ProjectThumbs.jsx) but every tile is a 2x2 block of backdrop cells,
 * with the icon in the middle and the handle along the bottom.
 */
export default function ContactTiles({ open = false }) {
  return (
    <nav className={`project_thumbs contact_tiles${open ? ' is-open' : ''}`} aria-label="Contact" aria-hidden={!open}>
      {contactLinks.map((c, i) => {
        const external = !c.url.startsWith('mailto:')
        return (
          <a
            key={c.id}
            href={c.url}
            className="project_thumb contact_tile"
            style={{ '--i': i }}
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
