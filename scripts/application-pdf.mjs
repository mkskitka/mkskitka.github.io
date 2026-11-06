// A cover letter and a resume as one page and one PDF. Copies the resume's page into the
// letter's HTML file, after the letter (between the resume:start / resume:end comments,
// refreshed on every run), then prints that file once, so the text stays real text and
// the links work.
//   node scripts/application-pdf.mjs <letter.html> <resume.html> <out.pdf> [dark|light]
//   npm run apply:openplans
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [letterFile, resumeFile, out, theme = 'dark'] = process.argv.slice(2)
if (!letterFile || !resumeFile || !out) {
  console.error('usage: node scripts/application-pdf.mjs <letter.html> <resume.html> <out.pdf> [dark|light]')
  process.exit(1)
}

const SCRIPT = '<script src="resume.js"></script>'
const START = `<!-- resume:start (copied from ${path.basename(resumeFile)} by scripts/application-pdf.mjs; edit resume.json, not this part) -->`
const END = '<!-- resume:end -->'
const letterPath = path.resolve(ROOT, letterFile)
const letter = await readFile(letterPath, 'utf8')
const resume = await readFile(path.resolve(ROOT, resumeFile), 'utf8')
const page = resume.match(/<div class="page">[\s\S]*<\/div>(?=\s*<script src="resume\.js">)/)
if (!page || !letter.includes(SCRIPT)) throw new Error('expected a <div class="page"> followed by resume.js in both files')

const block = `${START}\n  ${page[0].replace('<div class="page">', '<div class="page page_next">')}\n  ${END}`
const old = /<!-- resume:start[\s\S]*?<!-- resume:end -->/
const joined = old.test(letter) ? letter.replace(old, () => block) : letter.replace(SCRIPT, () => `${block}\n  ${SCRIPT}`)
if (joined !== letter) await writeFile(letterPath, joined)

execFileSync('sh', [path.join(ROOT, 'scripts', 'resume-pdf.sh'), out, theme, path.relative(ROOT, letterPath)], { stdio: 'inherit' })
