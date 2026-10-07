import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import HeroBackdrop from './HeroBackdrop.jsx'
import { projects } from '../data/projects.js'
import { systemsBackdrop } from '../data/videos.js'
import { gsap, ScrollTrigger } from '../lib/animations.js'

/**
 * The "Systems" project menu on the home page: a scroll-driven picker wheel.
 *
 * The section pins to the viewport (it owns its pin, hence `data-pin="self"` so
 * pinSections in Home.jsx leaves it alone). The selection slot is the top row of
 * the list window and never moves. While pinned, scrolling rolls the list up
 * through the slot one project per step, settling on each row: the project in the
 * slot is selected (accent color, a little larger), the rest sit dimmed below it.
 * A project that leaves through the top wraps around to the bottom, so the window
 * always shows a full list. Hovering any project makes it the selected one instead
 * (CSS in custom.css). When the wheel arrives at the last project it holds for
 * `hold` (fraction of the viewport, same beat as the other sections), then releases.
 *
 * Reduced-motion users get the plain static list.
 */
const SCROLL_PER_PROJECT = 0.3 // screens of scrolling per step (0.3 = 30% of the viewport height each)
const SETTLE = gsap.parseEase('power2.inOut') // how the list moves between rows: lingers, then slides
const FADE = 1 // how transparent a project is while crossing the top/bottom edge (1 = fully out = invisible)

export default function SystemsMenu({ hold = 0.75 }) {
  const root = useRef(null)

  useEffect(() => {
    const section = root.current
    if (!section) return
    const win = section.querySelector('.project_wheel')
    const list = section.querySelector('.project_wheel_list')
    const items = gsap.utils.toArray('.project_list', list)
    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      let rollPart = 1 // share of the pinned scroll spent rolling; the rest is the hold at the end
      let current = -1 // index of the selected project
      const steps = Math.max(1, items.length - 1)

      // Size the window to a whole number of rows: as many as fit under the heading,
      // but at least one short of the full list so the last project starts hidden.
      // The roll takes SCROLL_PER_PROJECT screens per step, then the section holds.
      const measure = () => {
        const holdPx = Math.round(window.innerHeight * hold)
        if (!items.length) return holdPx
        // Desktop: the panel hugs the list, so give the list window (which clips its
        // contents) enough right padding for the widest title at its selected size.
        // Phones use a full-width panel instead.
        if (window.matchMedia('(min-width: 768px)').matches) {
          const scale = parseFloat(getComputedStyle(list).getPropertyValue('--select-scale')) || 1
          const widest = Math.max(...items.map((i) => i.querySelector('.project_label')?.offsetWidth || 0))
          win.style.paddingRight = `${Math.round(widest * (scale - 1) + 24)}px`
        } else {
          win.style.paddingRight = ''
        }
        win.style.height = ''
        win.style.flex = ''
        const available = win.clientHeight
        // Rows can differ in height (titles wrap on phones), so walk the row tops:
        // the window ends at the top of the first row that doesn't fit, and always
        // hides at least the last row.
        let end = items[items.length - 1].offsetTop
        for (let k = 1; k < items.length; k++) {
          if (items[k].offsetTop > available) {
            end = Math.max(items[1].offsetTop, items[k].offsetTop)
            break
          }
        }
        win.style.height = `${end}px`
        win.style.flex = 'none'
        const rollPx = Math.round(steps * SCROLL_PER_PROJECT * window.innerHeight)
        rollPart = rollPx / (rollPx + holdPx)
        return rollPx + holdPx
      }

      const render = (progress) => {
        const p = gsap.utils.clamp(0, 1, progress / rollPart)
        const t = p * steps // 0..steps, fractional position along the list
        const i = Math.min(steps - 1, Math.floor(t))
        const f = t - i
        // Move the list so row i sits in the slot, settling before sliding on to row i+1.
        const from = items[i].offsetTop
        const to = items[i + 1] ? items[i + 1].offsetTop : from
        const y = -(from + (to - from) * SETTLE(f))

        const selected = Math.round(t)
        if (selected !== current) {
          items.forEach((item, idx) => item.classList.toggle('is-selected', idx === selected))
          current = selected
        }

        // Each row moves up by y. A row that has fully left through the top wraps
        // around by one full list length, so it reappears at the bottom and the
        // window always shows a complete list. Rows crossing an edge fade.
        const last = items[items.length - 1]
        const cycle = last.offsetTop + last.offsetHeight
        const H = win.clientHeight
        items.forEach((item) => {
          let top = item.offsetTop + y
          if (top + item.offsetHeight <= 0) top += cycle
          const bottom = top + item.offsetHeight
          let a = 0
          if (top < 0) a = gsap.utils.clamp(0, 1, -top / item.offsetHeight)
          else if (bottom > H) a = gsap.utils.clamp(0, 1, (bottom - H) / item.offsetHeight)
          gsap.set(item, { y: top - item.offsetTop, opacity: 1 - FADE * a })
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

    return () => {
      mm.revert()
      items.forEach((item) => item.classList.remove('is-selected'))
    }
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
                <span className="project_label">{p.title}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <HeroBackdrop nodeId="w-node-db868551-bfd6-d373-7992-34d064deac51-d8033e09" still={systemsBackdrop} />
    </header>
  )
}
