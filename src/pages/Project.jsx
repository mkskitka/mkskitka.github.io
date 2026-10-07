import { useEffect, useRef } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import HeroBackdrop from '../components/HeroBackdrop.jsx'
import Showcase from '../components/Showcase.jsx'
import { getProject } from '../data/projects.js'
import { revealSections } from '../lib/animations.js'

export default function Project() {
  const { slug } = useParams()
  const project = getProject(slug)
  const root = useRef(null)

  useEffect(() => revealSections(root.current), [slug])

  if (!project) return <Navigate to="/" replace />

  const [line1, line2] = project.heading ?? [project.title]

  return (
    <div ref={root} key={slug}>
      {/* Full-screen hero with back link and project title */}
      <header className="section is-full-screen">
        <HeroBackdrop
          nodeId="w-node-cdbde5e8-8b4f-e20c-bac0-1a4bbfefe3c5-bfefe3c3"
          nodeClass="w-node-f99f2480-672f-65d5-b6b3-accc741875a0-f0e05ae0"
          still={project.hero.still}
          {...(project.hero.video && { video: project.hero.video })}
        />
        <div className="header margin-bottom_none">
          <Link to="/" className="heading_primary hero_menu_text_color" aria-label="Back to home">
            &lt;-
          </Link>
          <a href="#Intro" className="heading_primary hero_menu_text_color">
            {line1}
            {line2 && (
              <>
                <br />
                {line2}
              </>
            )}
          </a>
        </div>
      </header>

      {/* Intro / details */}
      <header id="Intro" className="section">
        <div className="container">
          <div className="w-layout-grid grid_2-col tablet-1-col gap-large is-y-center">
            <div className="header margin-bottom_none">
              <div className="heading_primary w-richtext">
                <p className="paragraph-2">Role: {project.role}</p>
                <p className="paragraph-2">Mediums: {project.mediums}</p>
                <p className="paragraph-2">Description: {project.description}</p>
              </div>
            </div>
            <div id="w-node-_7008165b-a56e-77b3-4247-5274fa6daf54-f0e05ae0" className="grid-item-manual"></div>
          </div>
        </div>
      </header>

      <Showcase images={project.featured} />
    </div>
  )
}
