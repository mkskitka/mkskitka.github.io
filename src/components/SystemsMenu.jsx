import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import HeroBackdrop from './HeroBackdrop.jsx'
import { projects } from '../data/projects.js'
import { gsap, ScrollTrigger } from '../lib/animations.js'

/**
 * The "Systems" project menu on the home page.
 *
 * The section pins to the viewport like the others (it owns its own pin, hence
 * `data-pin="self"`), but if the project list is taller than the space under the
 * heading, scrolling while pinned turns the list into a wheel: it rolls through
 * the projects, with the ones near the middle upright and the ones at the edges
 * tilted away and faded. Once the wheel reaches the end, the section holds for
 * `hold` (a fraction of the viewport height, same as the other sections) and
 * then releases.
 *
 * If the whole list fits, it is a plain static list. Phones and reduced-motion
 * users always get the plain list.
 */
const TILT = 42 // degrees of rotation at the top/bottom edge of the wheel
const SHRINK = 0.3 // how much items scale down at the edge
const FADE = 0.7 // how much items fade at the edge

export default function SystemsMenu({ hold = 0.75 }) {
  const root = useRef(null)

  useEffect(() => {
    const section = root.current
    if (!section) return
    const win = section.querySelector('.project_wheel')
    const list = section.querySelector('.project_wheel_list')
    const items = gsap.utils.toArray('.project_list', list)
    const mm = gsap.matchMedia()

    mm.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
      let overflow = 0
      let wheelPart = 0 // fraction of the pin during which the wheel rolls

      // Total pinned scroll distance = wheel travel + hold beat. Re-run on every refresh.
      const measure = () => {
        overflow = Math.max(0, list.scrollHeight - win.clientHeight)
        const holdPx = Math.round(window.innerHeight * hold)
        wheelPart = overflow / (holdPx + overflow) || 0
        win.classList.toggle('is-overflowing', overflow > 0)
        return holdPx + overflow
      }

      const render = (progress) => {
        if (!overflow) {
          gsap.set(list, { y: 0 })
          gsap.set(items, { clearProps: 'transform,opacity' })
          return
        }
        const p = gsap.utils.clamp(0, 1, progress / wheelPart)
        const y = -overflow * p
        gsap.set(list, { y })

        const half = win.clientHeight / 2
        items.forEach((item) => {
          const center = list.offsetTop + y + item.offsetTop + item.offsetHeight / 2
          const d = gsap.utils.clamp(-1, 1, (center - half) / half) // -1 top edge, 0 middle, 1 bottom edge
          const a = Math.abs(d)
          gsap.set(item, {
            rotationX: -d * TILT,
            scale: 1 - SHRINK * a,
            opacity: 1 - FADE * a,
            transformOrigin: 'left center',
          })
        })
      }

      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: () => `+=${measure()}`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        refreshPriority: 1,
        onRefresh: (self) => render(self.progress),
        onUpdate: (self) => render(self.progress),
      })
    })

    return () => mm.revert()
  }, [hold])

  return (
    <header ref={root} id="Systems" className="section systems_menu" data-pin="self">
      <div className="container hero_menu">
        <div className="header is-align-center">
          <h2 className="heading_primary">SYSTEMS</h2>
          <div className="subheading w-richtext">
            <p>Visuals, computers, humans interacting in complex systems</p>
          </div>
        </div>
        <div className="project_wheel">
          <div className="header margin-bottom_none project_wheel_list">
            {projects.map((p) => (
              <Link key={p.slug} to={`/projects/${p.slug}`} className="heading_primary hero_menu_text_color project_list">
                {p.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <HeroBackdrop nodeId="w-node-db868551-bfd6-d373-7992-34d064deac51-d8033e09" />
    </header>
  )
}
