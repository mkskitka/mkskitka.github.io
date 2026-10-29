// Renders resume/resume.html and resume/cv.html from resume/resume.json (the one
// source for the resume, the CV, the PDFs and mkskitka.com/resume).
//   npm run resume:build
// The generated pages carry data-path / data-list attributes so the browser editor
// (scripts/resume-edit.mjs) can save edits back into the JSON.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const DATA = path.join(ROOT, 'resume', 'resume.json')

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// *text* -> <em>text</em>, everything else escaped
const rich = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>')
const bulletText = (b) => (typeof b === 'string' ? b : b.text)

const li = (b) => `<li${typeof b === 'object' && b.resumeOnly ? ' data-resume-only="1"' : ''}>${rich(bulletText(b))}</li>`
const entry = (i, title, when, bullets, listPath) => `
          <div class="entry">
            <h3 class="entry_title" data-path="${title.path}">${rich(title.text)}</h3>
            <span class="entry_when" data-path="${when.path}">${rich(when.text)}</span>${
              bullets.length
                ? `
            <ul data-list="${listPath}" data-tag="li">
${bullets.map((b) => `              ${li(b)}`).join('\n')}
            </ul>`
                : ''
            }
          </div>`

const yearList = (items, listPath) => `
          <ul class="teaching" data-list="${listPath}" data-kind="year" data-tag="li">
${items.map((t) => `            <li><span class="year">${esc(t.year)}</span>${rich(t.text)}</li>`).join('\n')}
          </ul>`

const skills = (d) => `
          <h2>Technical Skills</h2>
          <dl class="skills">
${d.skills
  .map(
    (g, i) => `            <div class="skill_group" data-list="skills.${i}.items" data-tag="dd">
              <dt data-path="skills.${i}.group">${rich(g.group)}</dt>
${g.items.map((it) => `              <dd>${rich(it)}</dd>`).join('\n')}
            </div>`
  )
  .join('\n')}
          </dl>`

const sideProjects = (d) => {
  const years = [...new Set(d.projects.map((p) => p.year))]
  return `
        <section>
          <h2>Selected Projects</h2>
          <dl class="skills">
${years
  .map(
    (y) => `            <div class="skill_group">
              <dt>${esc(y)}</dt>
${d.projects
  .map((p, i) => (p.year === y ? `              <dd data-path="projects.${i}.name">${rich(p.name)}</dd>` : null))
  .filter(Boolean)
  .join('\n')}
            </div>`
  )
  .join('\n')}
          </dl>
        </section>`
}

const header = (d) => `
    <header class="head panel">
      <div>
        <h1 class="head_name" data-path="name">${rich(d.name)}</h1>
        <p class="head_title" data-path="title">${rich(d.title)}</p>
      </div>
      <div class="head_contact">
        <span data-path="location">${rich(d.location)}</span><br>
        <a href="tel:${esc(d.phone.replace(/\D/g, ''))}" data-path="phone">${esc(d.phone)}</a> &nbsp;·&nbsp;
        <a href="mailto:${esc(d.email)}" data-path="email">${esc(d.email)}</a><br>
        <a class="head_site" href="https://${esc(d.site)}/">${esc(d.site)}</a>${
          d.linkedin ? ` &nbsp;·&nbsp; <a href="https://${esc(d.linkedin)}">LinkedIn</a>` : ''
        }
      </div>
    </header>`

const page = (d, cv) => {
  const jobs = d.jobs
    .map((j, i) =>
      entry(
        i,
        { path: `jobs.${i}.title`, text: j.title },
        { path: `jobs.${i}.when`, text: j.when },
        j.bullets.filter((b) => !(cv && b.resumeOnly)),
        `jobs.${i}.bullets`
      )
    )
    .join('\n')
  const edu = d.education
    .map((e, i) => entry(i, { path: `education.${i}.degree`, text: e.degree }, { path: `education.${i}.when`, text: e.when }, [], ''))
    .join('\n')
  const extra = cv
    ? d.cv
        .map(
          (s, i) => `
        <section>
          <h2>${esc(s.heading)}</h2>${yearList(s.items, `cv.${i}.items`)}
        </section>`
        )
        .join('\n')
    : `
        <section>
          <h2>Additional Teaching Experience</h2>${yearList(d.teaching, 'teaching')}
        </section>`
  return `<!-- page:start -->${header(d)}

    <div class="cols">
      <aside class="side panel">
        <section>${skills(d)}
        </section>${cv ? '' : sideProjects(d)}
      </aside>

      <main class="main panel">
        <section>
          <h2>Profile</h2>
          <p data-path="profile.${cv ? 'cv' : 'resume'}">${rich(cv ? d.profile.cv : d.profile.resume)}</p>
        </section>

        <section>
          <h2>${cv ? 'Professional Experience' : 'Employment History'}</h2>${jobs}
        </section>

        <section>
          <h2>Education</h2>${edu}
        </section>
${extra}
      </main>
    </div>
    <!-- page:end -->`
}

const shell = (d, cv, body) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(d.name)} — ${cv ? 'CV' : 'Resume'}</title>
  <!-- GENERATED by scripts/resume-build.mjs from resume/resume.json. Edit the JSON
       (or use npm run resume:edit), not this file. -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="resume.css" />
</head>
<body class="${cv ? 'cv' : 'resume'}">
  <div class="page">
    ${body}
  </div>
  <script src="resume.js"></script>
</body>
</html>
`

export async function build() {
  const d = JSON.parse(await readFile(DATA, 'utf8'))
  await writeFile(path.join(ROOT, 'resume', 'resume.html'), shell(d, false, page(d, false)))
  await writeFile(path.join(ROOT, 'resume', 'cv.html'), shell(d, true, page(d, true)))
  return d
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build()
  console.log('built resume/resume.html and resume/cv.html from resume/resume.json')
}
