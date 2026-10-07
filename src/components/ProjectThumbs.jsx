import { projects } from '../data/projects.js'

/**
 * The Systems grid: one square tile per project, shown next to the hero menu
 * when SYSTEMS is selected. On desktop every tile spans a whole number of
 * backdrop grid cells (--thumb-cells in custom.css: 3 = a 3x3 block, 2 = 2x2)
 * and the gaps are whole cells too, so the tiles sit on the grid lines like the
 * menu panel does. Phones get a plain two-column grid.
 *
 * Thumbnails come from src/data/projects.js (`thumb`): an image, a gif, or a
 * looping muted video. `onSelect(project)` runs when a tile is clicked; the
 * tile links to /projects/<slug> for when the project pages are turned back on
 * in App.jsx.
 */
export default function ProjectThumbs({ open = false, onSelect }) {
  return (
    <nav className={`project_thumbs${open ? ' is-open' : ''}`} aria-label="Projects" aria-hidden={!open}>
      {projects.map((p, i) => (
        <a
          key={p.slug}
          href={`/projects/${p.slug}`}
          className="project_thumb"
          style={{ '--i': i }}
          tabIndex={open ? 0 : -1}
          onClick={(e) => {
            if (!onSelect) return
            e.preventDefault()
            onSelect(p)
          }}
        >
          <span className="project_thumb_media">
            {p.thumb?.video ? (
              <video autoPlay muted loop playsInline preload="metadata" poster={p.thumb.video.poster}>
                {p.thumb.video.webm && <source src={p.thumb.video.webm} type="video/webm" />}
                {p.thumb.video.mp4 && <source src={p.thumb.video.mp4} type="video/mp4" />}
              </video>
            ) : p.thumb?.image ? (
              <img src={p.thumb.image} alt="" loading="lazy" />
            ) : null}
          </span>
          <span className="project_thumb_title">{p.title}</span>
        </a>
      ))}
    </nav>
  )
}
