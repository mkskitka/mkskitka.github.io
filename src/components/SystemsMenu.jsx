import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import HeroBackdrop from './HeroBackdrop.jsx'
import { projects } from '../data/projects.js'
import { systemsBackdrop } from '../data/videos.js'
import { gsap, ScrollTrigger } from '../lib/animations.js'

/**
 * The "Systems" project menu on the home page.
 *
 * The section pins to the viewport (it owns its pin, hence `data-pin="self"` so
 * pinSections in Home.jsx leaves it alone). When it arrives, the list window is
 * sized so the last project (Evidence 71) is hidden just below it. Scrolling while
 * pinned rolls the list up: the first entry tilts back, shrinks and fades out
 * through the top while the last one grows into view from the bottom. Entries in
 * the middle stay full size. When the wheel reaches the end, the section holds
 * for `hold` (fraction of the viewport, same beat as the other sections), then
 * releases.
 *
 * Tune the feel with the constants below. Phones get the plain static list (still
 * pinned for the beat); reduced-motion users get a plain, unpinned list.
 */
const TILT = 35 // degrees an entry tilts as it leaves/enters (0 for none)
const SHRINK = 0.6 // how small an entry gets when fully out (0.6 = 40% size)
const FADE = 1 // how transparent it gets when fully out (1 = invisible)
const ROLL = 0.75 // share of the pinned scroll spent rolling; the rest is a still hold at the end
const EXTRA_ROLL = 0 // extra travel past "last entry fully in", in entry heights (0.5 = half an entry)
const EASE = gsap.parseEase('power2.inOut')

export default function SystemsMenu({ hold = 0.75 }) {
  const root = useRef(null)

  useEffect(() => {
    const section = root.current
    if (!section) return
    const win = section.querySelector('.project_wheel')
    const list = section.querySelector('.project_wheel_list')
    const items = gsap.utils.toArray('.project_list', list)
    const mm = gsap.matchMedia()

    // Phones don't get the wheel, but the section still pins for the usual beat
    // (pinSections in Home.jsx skips this section because of data-pin="self").
    mm.add('(max-width: 767px) and (prefers-reduced-motion: no-preference)', () => {
      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: () => `+=${Math.round(window.innerHeight * hold)}`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        refreshPriority: 1,
      })
    })

    mm.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
      let travel = 0 // how far the list moves, in px

      // Size the window so the last entry is hidden just below it at the start, then
      // roll exactly far enough that it is fully in and the first entry is fully out.
      // (Raise EXTRA_ROLL, in entry heights, to roll further and push more entries out.)
      // The section stays pinned for the usual hold distance plus the travel.
      const measure = () => {
        const first = items[0]
        const last = items[items.length - 1]
        if (!first || !last) return Math.round(window.innerHeight * hold)
        const room = Math.round(last.offsetHeight * EXTRA_ROLL)
        const contentH = last.offsetTop + last.offsetHeight + room
        win.style.maxHeight = `${last.offsetTop}px` // window ends where the last entry begins
        travel = Math.max(0, contentH - win.clientHeight)
        return Math.round(window.innerHeight * hold) + travel
      }

      // d = 0 while an entry is fully inside the window; -1 when it has fully left
      // through the top; +1 while it is still fully below the bottom edge.
      const render = (progress) => {
        const p = gsap.utils.clamp(0, 1, progress / ROLL)
        const y = -travel * EASE(p)
        gsap.set(list, { y })

        const H = win.clientHeight
        items.forEach((item) => {
          const top = item.offsetTop + y
          const bottom = top + item.offsetHeight
          let d = 0
          if (top < 0) d = -gsap.utils.clamp(0, 1, -top / item.offsetHeight)
          else if (bottom > H) d = gsap.utils.clamp(0, 1, (bottom - H) / item.offsetHeight)
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
      <HeroBackdrop nodeId="w-node-db868551-bfd6-d373-7992-34d064deac51-d8033e09" still={systemsBackdrop} />
    </header>
  )
}
