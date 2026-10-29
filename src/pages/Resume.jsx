import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import GridInkBackdrop from '../components/GridInkBackdrop.jsx'
import resumeSource from '../../resume/resume.html?raw'
import '../styles/resume.css'

/**
 * /resume: the resume as a page of the site, on the live grid backdrop, in the same
 * frosted glass panels as the rest of the site.
 *
 * The content is the resume itself: everything between the page:start / page:end
 * markers in resume/resume.html (the file `npm run resume:edit` edits and the PDF is
 * exported from), so this page, the editor and the PDF never drift apart. The
 * styling here is the site's (src/styles/resume.css); the file's own CSS is for
 * the printed PDF only.
 *
 * The page scrolls inside .resume_scroll (the site keeps the window itself from
 * scrolling), and the backdrop leaves wheel/touch inside it alone.
 */
const PAGE_HTML = (resumeSource.match(/<!-- page:start -->([\s\S]*?)<!-- page:end -->/) || [, ''])[1]

export default function Resume() {
  useEffect(() => {
    document.title = 'Resume — MK Skitka'
  }, [])

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
              <a className="resume_pdf" href="/resume.pdf" download="MK_Skitka_Resume.pdf">
                PDF -&gt;
              </a>
            </nav>
            <div className="resume_page" dangerouslySetInnerHTML={{ __html: PAGE_HTML }} />
          </div>
        </div>
      </section>
    </div>
  )
}
