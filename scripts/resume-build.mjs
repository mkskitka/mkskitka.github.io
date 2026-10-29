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
const entry = (i, title, when, bullets, listPath, sub = '', cls = 'entry') => `
          <div class="${cls}">
            <h3 class="entry_title" data-path="${title.path}">${rich(title.text)}</h3>
            <span class="entry_when" data-path="${when.path}">${rich(when.text)}</span>${
              bullets.length
                ? `
            <ul data-list="${listPath}" data-tag="li">
${bullets.map((b) => `              ${li(b)}`).join('\n')}
            </ul>`
                : ''
            }${sub}
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

const header = (d, v = null, vpath = '') => `
    <header class="head panel">
      <div>
        <h1 class="head_name" data-path="name">${rich(d.name)}</h1>
        <p class="head_title" data-path="${v?.title ? vpath + 'title' : 'title'}">${rich(v?.title ?? d.title)}</p>
      </div>
      <div class="head_contact">
        <span data-path="location">${rich(d.location)}</span><br>
        <a href="tel:${esc(d.phone.replace(/\D/g, ''))}" data-path="phone">${esc(d.phone)}</a> &nbsp;·&nbsp;
        <a href="mailto:${esc(d.email)}" data-path="email">${esc(d.email)}</a><br>
        <a class="head_site" href="https://${esc(d.site)}/">${esc(d.site)}</a>${
          d.linkedin ? ` &nbsp;·&nbsp; <a href="https://${esc(d.linkedin)}">LinkedIn</a>` : ''
        }${d.instagram ? ` &nbsp;·&nbsp; <a href="https://${esc(d.instagram)}">Instagram</a>` : ''}
      </div>
    </header>`

// One page of content. `variant` names an entry in resume.json "variants": its own
// title line, profile and section order, and optionally some jobs pulled up into a
// teaching section. Bullets may carry only: [variants] / not: [variants].
const page = (d, cv, variant = null) => {
  const v = variant ? d.variants?.[variant] : null
  if (variant && !v) throw new Error(`no variant "${variant}" in resume.json`)
  const vpath = variant ? `variants.${variant}.` : ''
  const keep = (bullets) =>
    bullets.filter((b) => {
      if (typeof b === 'string') return true
      if (cv && b.resumeOnly) return false
      if (b.only && !(variant && b.only.includes(variant))) return false
      if (b.not && variant && b.not.includes(variant)) return false
      return true
    })
  // A job may carry sub-entries (contracts nested under a freelance heading): jobs.i.sub.k
  const subs = (j, i) =>
    (j.sub || [])
      .map((s, k) =>
        entry(
          k,
          { path: `jobs.${i}.sub.${k}.title`, text: s.title },
          { path: `jobs.${i}.sub.${k}.when`, text: s.when },
          keep(s.bullets),
          `jobs.${i}.sub.${k}.bullets`,
          '',
          'entry entry_sub'
        )
      )
      .join('\n')
  const jobEntry = (j, i) =>
    entry(i, { path: `jobs.${i}.title`, text: j.title }, { path: `jobs.${i}.when`, text: j.when }, keep(j.bullets), `jobs.${i}.bullets`, subs(j, i))
  const ts = v?.teachingSection
  const isTeachingJob = (j) => !!ts && ts.jobs.some((t) => j.title.startsWith(t))
  const jobs = d.jobs.map((j, i) => (isTeachingJob(j) ? null : jobEntry(j, i))).filter(Boolean).join('\n')
  const teachingJobs = d.jobs.map((j, i) => (isTeachingJob(j) ? jobEntry(j, i) : null)).filter(Boolean).join('\n')
  const edu = d.education
    .map((e, i) => entry(i, { path: `education.${i}.degree`, text: e.degree }, { path: `education.${i}.when`, text: e.when }, [], ''))
    .join('\n')
  const section = (h, body) => `
        <section>
          <h2>${esc(h)}</h2>${body}
        </section>`
  const sections = {
    profile: section(
      'Profile',
      `
          <p data-path="${v ? vpath + 'profile' : 'profile.' + (cv ? 'cv' : 'resume')}">${rich(v ? v.profile : cv ? d.profile.cv : d.profile.resume)}</p>`
    ),
    jobs: section(v?.jobsHeading ?? (cv ? 'Professional Experience' : 'Employment History'), jobs),
    education: section('Education', edu),
    teaching: ts
      ? section(
          ts.heading,
          teachingJobs +
            (ts.listHeading ? `\n          <h3 class="entry_title list_heading">${esc(ts.listHeading)}</h3>` : '') +
            yearList(d.teaching, 'teaching')
        )
      : section('Additional Teaching Experience', yearList(d.teaching, 'teaching')),
    cv: d.cv.map((s, i) => section(s.heading, yearList(s.items, `cv.${i}.items`))).join('\n'),
  }
  const order = cv ? ['profile', 'jobs', 'education', 'cv'] : v?.sections ?? ['profile', 'jobs', 'education', 'teaching']
  return `<!-- page:start -->${header(d, v, vpath)}

    <div class="cols">
      <main class="main panel">${order.map((k) => sections[k] ?? '').join('\n')}
      </main>

      <aside class="side panel">
        <section>${skills(d)}
        </section>${cv ? '' : sideProjects(d)}
      </aside>
    </div>
    <!-- page:end -->`
}

const shell = (d, cv, body, doc = 'resume', variant = null) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(d.name)} — ${cv ? 'CV' : variant ? `Resume (${variant})` : 'Resume'}</title>
  <!-- GENERATED by scripts/resume-build.mjs from resume/resume.json. Edit the JSON
       (or use npm run resume:edit), not this file. -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="resume.css" />
</head>
<body class="${cv ? 'cv' : 'resume'}${variant ? ` variant-${variant}` : ''}" data-doc="${doc}">
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
  await writeFile(path.join(ROOT, 'resume', 'cv.html'), shell(d, true, page(d, true), 'cv'))
  for (const name of Object.keys(d.variants ?? {})) {
    await writeFile(path.join(ROOT, 'resume', `resume-${name}.html`), shell(d, false, page(d, false, name), `resume-${name}`, name))
  }
  return d
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build()
  console.log('built resume/resume.html, resume/cv.html and the variants (resume/resume-<name>.html) from resume/resume.json')
}
