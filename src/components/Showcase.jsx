import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../lib/animations.js'

/**
 * Scroll-driven collage of 3-4 images.
 *
 * Desktop: the stage sticks to the viewport while the section scrolls (~2 screens).
 * Each image flies in from a different edge, settles slightly askew, then drifts
 * with parallax. A huge outlined title slides behind them. Hover an image to bring
 * it forward and dim the others.
 *
 * Mobile / reduced motion: simple stacked grid with a fade-up.
 *
 * Each image's size, position and resting tilt come from the project data
 * (src/data/projects.js). Entry direction per tile is ENTRY below.
 */
const ENTRY = [
  { x: -70, y: 15, r: -14 }, // from the left
  { x: 50, y: -70, r: 10 }, // from the top right
  { x: 80, y: 40, r: -8 }, // from the right
  { x: -25, y: 90, r: 12 }, // from below
]

export default function Showcase({ images, title }) {
  const root = useRef(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const mm = gsap.matchMedia()

    mm.add(
      {
        desktop: '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
        simple: '(max-width: 767px), (prefers-reduced-motion: reduce)',
      },
      (ctx) => {
        const tiles = gsap.utils.toArray('.showcase_tile', el)
        const ghost = el.querySelector('.showcase_ghost')
        const eyebrow = el.querySelector('.showcase_eyebrow')

        if (ctx.conditions.simple) {
          gsap.from(tiles, {
            autoAlpha: 0,
            y: 60,
            duration: 0.8,
            ease: 'power2.out',
            stagger: 0.15,
            scrollTrigger: { trigger: el, start: 'top 75%', once: true },
          })
          return
        }

        const tl = gsap.timeline({
          defaults: { ease: 'power2.out' },
          scrollTrigger: { trigger: el, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
        })

        // Phase 1: tiles fly in one after another and settle at their resting tilt.
        tiles.forEach((tile, i) => {
          const e = ENTRY[i % ENTRY.length]
          const rest = parseFloat(tile.dataset.rotate || 0)
          tl.fromTo(
            tile,
            { xPercent: e.x, yPercent: e.y, rotation: e.r, scale: 0.85, autoAlpha: 0 },
            { xPercent: 0, yPercent: 0, rotation: rest, scale: 1, autoAlpha: 1, duration: 1 },
            i * 0.35,
          )
        })
        const landed = (tiles.length - 1) * 0.35 + 1

        // Phase 2: parallax drift at different speeds while the user keeps scrolling.
        tiles.forEach((tile, i) => {
          const rest = parseFloat(tile.dataset.rotate || 0)
          tl.to(
            tile,
            { yPercent: -(5 + i * 4), rotation: rest + (i % 2 ? 1.5 : -1.5), duration: 1.6, ease: 'none' },
            landed,
          )
        })

        if (ghost) tl.fromTo(ghost, { xPercent: 6 }, { xPercent: -22, duration: landed + 1.6, ease: 'none' }, 0)
        if (eyebrow) tl.from(eyebrow, { autoAlpha: 0, y: 20, duration: 0.6 }, 0)
      },
    )

    return () => mm.revert()
  }, [images])

  // Re-measure once images have real dimensions (mostly matters for the simple layout).
  useEffect(() => {
    const t = setTimeout(() => ScrollTrigger.refresh(), 300)
    return () => clearTimeout(t)
  }, [images])

  const shown = images.slice(0, 4)

  return (
    <section ref={root} className="section showcase" aria-label="Selected frames">
      <div className="showcase_stage">
        <div className="showcase_ghost" aria-hidden="true">
          {title}
        </div>
        <div className="showcase_eyebrow">
          SELECTED FRAMES <span className="showcase_eyebrow-count">01 — {String(shown.length).padStart(2, '0')}</span>
        </div>
        {shown.map((img, i) => (
          <figure
            className="showcase_tile"
            key={`${img.src}-${i}`}
            data-rotate={img.rotate ?? 0}
            style={{
              width: img.width,
              top: img.top,
              bottom: img.bottom,
              left: img.left,
              right: img.right,
              '--aspect': img.aspect,
            }}
          >
            <span className="showcase_index" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="showcase_frame">
              <img src={img.src} alt={img.alt ?? ''} loading="lazy" />
            </div>
            {img.caption && <figcaption className="showcase_caption">{img.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </section>
  )
}
