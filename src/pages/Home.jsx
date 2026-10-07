import { useEffect, useRef } from 'react'
import HeroBackdrop from '../components/HeroBackdrop.jsx'
import { pinSections, revealSections } from '../lib/animations.js'

// The site is currently just the hero. The earlier sections (Intro, Systems wheel,
// Contact) and the project pages are kept in src/ for reference; see
// src/pages/Home.full.jsx for the previous full home page.
export default function Home() {
  const root = useRef(null)
  useEffect(() => {
    const unpin = pinSections(root.current, { hold: 0.75 })
    const unreveal = revealSections(root.current)
    return () => {
      unreveal()
      unpin()
    }
  }, [])

  return (
    <div ref={root} className="home">
      {/* Full-screen hero with site menu. data-hold: pinned for 1.5 screens of scrolling;
          the grid's vertical lines reach the bottom at 65% of that, the rest is a pause. */}
      <header className="section is-full-screen" data-hold="1.5">
        <HeroBackdrop
          nodeId="w-node-cdbde5e8-8b4f-e20c-bac0-1a4bbfefe3c5-bfefe3c3"
          nodeClass="w-node-f99f2480-672f-65d5-b6b3-accc741875a0-d8033e09"
          sketch
        />
        <div className="header margin-bottom_none">
          <a href="#" className="heading_primary hero_menu_text_color">MK SKITKA</a>
          <a href="#" className="heading_primary hero_menu_text_color">SYSTEMS</a>
          <a href="#" className="heading_primary hero_menu_text_color">VISUALS</a>
          <a href="#" className="heading_primary hero_menu_text_color">CONTACT</a>
        </div>
      </header>
    </div>
  )
}
