import { Fragment, useEffect } from 'react'
import { Link } from 'react-router-dom'
import GridInkBackdrop from '../components/GridInkBackdrop.jsx'
import resume from '../../resume/resume.json'
import '../styles/resume.css'

/**
 * /resume: the resume as a page of the site, on the live grid backdrop, in the same
 * frosted glass panels as the rest of the site.
 *
 * The content is resume/resume.json, the one source the printed resume, the CV and
 * the PDF are built from too (scripts/resume-build.mjs; edit with npm run
 * resume:edit). The class names match the printed page so src/styles/resume.css
 * styles both the same way.
 *
 * The page scrolls inside .resume_scroll (the site keeps the window itself from
 * scrolling), and the backdrop leaves wheel/touch inside it alone.
 */

// *text* -> <em>text</em>
const rich = (s) =>
  String(s ?? '')
    .split(/(\*[^*]+\*)/)
    .map((part, i) => (part.startsWith('*') && part.endsWith('*') ? <em key={i}>{part.slice(1, -1)}</em> : part))

const bulletText = (b) => (typeof b === 'string' ? b : b.text)

export default function Resume() {
  useEffect(() => {
    document.title = 'Resume — MK Skitka'
  }, [])
  const d = resume
  const years = [...new Set(d.projects.map((p) => p.year))]

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
            <div className="resume_page">
              <header className="head panel">
                <div>
                  <h1 className="head_name">{d.name}</h1>
                  <p className="head_title">{d.title}</p>
                </div>
                <div className="head_contact">
                  {d.location}
                  <br />
                  <a href={`tel:${d.phone.replace(/\D/g, '')}`}>{d.phone}</a> &nbsp;·&nbsp; <a href={`mailto:${d.email}`}>{d.email}</a>
                  <br />
                  <a className="head_site" href={`https://${d.site}/`}>
                    {d.site}
                  </a>
                  {d.linkedin && (
                    <>
                      {' '}
                      &nbsp;·&nbsp; <a href={`https://${d.linkedin}`}>LinkedIn</a>
                    </>
                  )}
                  {d.instagram && (
                    <>
                      {' '}
                      &nbsp;·&nbsp; <a href={`https://${d.instagram}`}>Instagram</a>
                    </>
                  )}
                </div>
              </header>

              <div className="cols">
                <aside className="side panel">
                  <section>
                    <h2>Technical Skills</h2>
                    <dl className="skills">
                      {d.skills.map((g) => (
                        <div className="skill_group" key={g.group}>
                          <dt>{g.group}</dt>
                          {g.items.map((it) => (
                            <dd key={it}>{it}</dd>
                          ))}
                        </div>
                      ))}
                    </dl>
                  </section>
                  <section>
                    <h2>Selected Projects</h2>
                    <dl className="skills">
                      {years.map((y) => (
                        <div className="skill_group" key={y}>
                          <dt>{y}</dt>
                          {d.projects
                            .filter((p) => p.year === y)
                            .map((p) => (
                              <dd key={p.name}>{p.slug ? <Link to={`/projects/${p.slug}`}>{p.name}</Link> : p.name}</dd>
                            ))}
                        </div>
                      ))}
                    </dl>
                  </section>
                </aside>

                <main className="main panel">
                  <section>
                    <h2>Profile</h2>
                    <p>{rich(d.profile.resume)}</p>
                  </section>

                  <section>
                    <h2>Employment History</h2>
                    {d.jobs.map((j) => (
                      <div className="entry" key={j.title + j.when}>
                        <h3 className="entry_title">{j.title}</h3>
                        <span className="entry_when">{j.when}</span>
                        {j.bullets.length > 0 && (
                          <ul>
                            {j.bullets.map((b, i) => (
                              <li key={i}>{rich(bulletText(b))}</li>
                            ))}
                          </ul>
                        )}
                        {(j.sub || []).map((s) => (
                          <div className="entry entry_sub" key={s.title + s.when}>
                            <h3 className="entry_title">{s.title}</h3>
                            <span className="entry_when">{s.when}</span>
                            {s.bullets.length > 0 && (
                              <ul>
                                {s.bullets.map((b, i) => (
                                  <li key={i}>{rich(bulletText(b))}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </section>

                  <section>
                    <h2>Education</h2>
                    {d.education.map((e) => (
                      <div className="entry" key={e.degree}>
                        <h3 className="entry_title">{e.degree}</h3>
                        <span className="entry_when">{e.when}</span>
                      </div>
                    ))}
                  </section>

                  <section>
                    <h2>Additional Teaching Experience</h2>
                    <ul className="teaching">
                      {d.teaching.map((t, i) => (
                        <li key={i}>
                          <span className="year">{t.year}</span>
                          {rich(t.text)}
                        </li>
                      ))}
                    </ul>
                  </section>
                </main>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
