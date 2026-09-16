import { useEffect, useRef } from 'react'
import HeroBackdrop from '../components/HeroBackdrop.jsx'
import BackgroundVideo from '../components/BackgroundVideo.jsx'
import { introVideoA, introVideoB } from '../data/videos.js'
import SystemsMenu from '../components/SystemsMenu.jsx'
import ContactSection from '../components/ContactSection.jsx'
import { pinSections, revealSections } from '../lib/animations.js'

// How long each section stays pinned, as a fraction of the viewport height.
const HOLD = 0.75

export default function Home() {
  const root = useRef(null)
  useEffect(() => {
    // Create the pins first so the reveal triggers measure against the pinned layout.
    const unpin = pinSections(root.current, { hold: HOLD })
    const unreveal = revealSections(root.current)
    return () => {
      unreveal()
      unpin()
    }
  }, [])

  return (
    <div ref={root} className="home">
      {/* Full-screen hero with site menu */}
      <header className="section is-full-screen">
        <HeroBackdrop
          nodeId="w-node-cdbde5e8-8b4f-e20c-bac0-1a4bbfefe3c5-bfefe3c3"
          nodeClass="w-node-f99f2480-672f-65d5-b6b3-accc741875a0-d8033e09"
        />
        <div className="header margin-bottom_none">
          <a href="#Intro" className="heading_primary hero_menu_text_color">MK SKITKA</a>
          <a href="#Systems" className="heading_primary hero_menu_text_color">SYSTEMS</a>
          <a href="#" className="heading_primary hero_menu_text_color">VISUALS</a>
          <a href="#Contact" className="heading_primary hero_menu_text_color">CONTACT</a>
        </div>
      </header>

      {/* Intro */}
      <header id="Intro" className="section">
        <div className="container">
          <div className="w-layout-grid grid_2-col tablet-1-col gap-large is-y-center">
            <div className="header margin-bottom_none">
              <h1 className="heading_primary">MK SKITKA</h1>
              <div className="heading_primary w-richtext">
                <p className="paragraph-2">
                  Specializes in crafting visual systems for live events. She practices generative art (Visuals)
                  and observes how those materials interact with their environment (Systems).
                </p>
              </div>
            </div>
            <div id="w-node-_7008165b-a56e-77b3-4247-5274fa6daf54-d8033e09" className="grid-item-manual">
              <BackgroundVideo video={introVideoA} className="background-video">
                <div className="text-block"></div>
              </BackgroundVideo>
              <BackgroundVideo video={introVideoB} className="background-video-2" />
              <div className="text-block"></div>
            </div>
          </div>
        </div>
      </header>

      {/* Systems project menu (pins itself and rolls the list as a wheel) */}
      <SystemsMenu hold={HOLD} />

      {/* Contact */}
      <ContactSection />
    </div>
  )
}
