import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import GridInkBackdrop from '../components/GridInkBackdrop.jsx'
import resumeHtml from '../../resume/resume-site.html?raw'
import '../styles/resume.css'

/**
 * /resume: the resume as a page of the site, on the live grid backdrop, in the same
 * frosted glass panels as the rest of the site.
 *
 * The content is resume/resume-site.html, the "site" variant (no profile paragraph)
 * that scripts/resume-build.mjs renders from resume/resume.json (edit with npm run
 * resume:edit, then npm run resume:build). The part between the page:start /
 * page:end markers is dropped in as is; src/styles/resume.css restyles its class
 * names for the screen.
 *
 * The page scrolls inside .resume_scroll (the site keeps the window itself from
 * scrolling), and the backdrop leaves wheel/touch inside it alone.
 */

const SITE = 'https://mkskitka.com'
const page = (() => {
  const m = resumeHtml.match(/<!-- page:start -->([\s\S]*)<!-- page:end -->/)
  return m ? m[1] : resumeHtml
})()

export default function Resume() {
  const navigate = useNavigate()
  useEffect(() => {
    document.title = 'Resume — MK Skitka'
  }, [])

  // Links to this site (the project pages) stay in the app instead of reloading it.
  const onClick = (e) => {
    const a = e.target.closest('a[href]')
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return
    const href = a.getAttribute('href')
    if (!href.startsWith(SITE + '/')) return
    e.preventDefault()
    navigate(href.slice(SITE.length))
  }

  return (
    <div className="home home--fixed resume">
      <section className="section is-full-screen resume_section">
        <GridInkBackdrop className="image_cover position_absolute" />
        <div className="resume_scroll">
          <div className="resume_doc">
            <nav className="resume_nav">
              <Link to="/about" className="resume_back" aria-label="Back to about">
                &lt;-
              </Link>
            </nav>
            <div className="resume_page" onClick={onClick} dangerouslySetInnerHTML={{ __html: page }} />
          </div>
        </div>
      </section>
    </div>
  )
}
