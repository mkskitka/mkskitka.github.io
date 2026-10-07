import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../lib/animations.js'

/**
 * Scroll-driven collage of 3-4 images.
 *
 * Desktop: the stage sticks to the viewport while the section scrolls (~1 screen).
 * Each image slides in from a different edge and settles square; once landed it
 * stays put. Layouts in projects.js are spaced so the images never overlap on
 * desktop. Hover an image to bring it forward and dim the others.
 *
 * Mobile / reduced motion: simple stacked grid with a fade-up.
 *
 * Each image's size and position come from the project data (src/data/projects.js).
 * Entry direction per tile is ENTRY below.
 */
const ENTRY = [
  { x: -30, y: 6 }, // from the left
  { x: 20, y: -30 }, // from the top right
  { x: 35, y: 15 }, // from the right
  { x: -10, y: 40 }, // from below
]

export default function Showcase({ images }) {
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

        // Tiles slide in one after another and settle square, then hold still.
        tiles.forEach((tile, i) => {
          const e = ENTRY[i % ENTRY.length]
          tl.fromTo(
            tile,
            { xPercent: e.x, yPercent: e.y, scale: 0.95, autoAlpha: 0 },
            { xPercent: 0, yPercent: 0, scale: 1, autoAlpha: 1, duration: 1 },
            i * 0.35,
          )
        })
        const landed = (tiles.length - 1) * 0.35 + 1
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
        {shown.map((img, i) => (
          <figure
            className="showcase_tile"
            key={`${img.src}-${i}`}
            style={{
              width: img.width,
              top: img.top,
              bottom: img.bottom,
              left: img.left,
              right: img.right,
              '--aspect': img.aspect,
            }}
          >
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
