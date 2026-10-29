// Edit the resume (or the CV) in the browser: serves the generated pages with edit
// mode on, saves edits back into resume/resume.json, rebuilds the pages, and exports
// PDFs on request.
//   npm run resume:edit        then http://localhost:5181/?edit  (CV: /cv?edit)
//   Ctrl+C to stop
import http from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { build, DATA } from './resume-build.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 5181
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' }

const body = (req) =>
  new Promise((resolve) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  })
const json = (res, code, data) => {
  res.writeHead(code, { 'content-type': 'application/json' })
  res.end(JSON.stringify(data))
}

// "jobs.2.bullets" -> the parent object and the final key
const locate = (obj, dotted) => {
  const keys = dotted.split('.')
  const last = keys.pop()
  let o = obj
  for (const k of keys) {
    if (o == null || !(k in o)) return null
    o = o[k]
  }
  return o == null ? null : { o, k: last }
}

const applyEdits = (d, { fields = [], lists = [] }) => {
  for (const f of fields) {
    const at = locate(d, f.path)
    if (at && typeof at.o[at.k] === 'string') at.o[at.k] = f.value
  }
  for (const l of lists) {
    const at = locate(d, l.path)
    if (!at || !Array.isArray(at.o[at.k])) continue
    // items arrive as strings, { year, text } or { text, resumeOnly }, exactly as stored
    at.o[at.k] = l.items
  }
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`)
    try {
      if (req.method === 'GET') {
        let file = url.pathname === '/' ? '/resume.html' : url.pathname === '/cv' ? '/cv.html' : url.pathname
        file = path.normalize(file).replace(/^(\.\.[/\\])+/, '')
        const ext = path.extname(file)
        if (!TYPES[ext]) {
          res.writeHead(404)
          return res.end('not found')
        }
        const data = await readFile(path.join(ROOT, 'resume', file))
        res.writeHead(200, { 'content-type': TYPES[ext], 'cache-control': 'no-store' })
        res.end(data)
      } else if (req.method === 'POST' && url.pathname === '/save') {
        const edits = JSON.parse(await body(req))
        if (!Array.isArray(edits.fields) || !Array.isArray(edits.lists)) return json(res, 400, { error: 'bad save payload' })
        const d = JSON.parse(await readFile(DATA, 'utf8'))
        applyEdits(d, edits)
        await writeFile(DATA, JSON.stringify(d, null, 2) + '\n')
        await build()
        json(res, 200, { ok: true, file: DATA })
      } else if (req.method === 'POST' && url.pathname === '/export') {
        const { theme, doc } = JSON.parse((await body(req)) || '{}')
        const stamp = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }).replace('/', '_')
        const which = doc === 'cv' ? 'CV' : 'Resume'
        const out = path.join(process.env.HOME, 'Desktop', `MK_Skitka_${which}_${stamp}${theme === 'light' ? '_light' : ''}.pdf`)
        const args = [path.join(ROOT, 'scripts', 'resume-pdf.sh'), out, theme === 'light' ? 'light' : 'dark', doc === 'cv' ? 'resume/cv.html' : 'resume/resume.html']
        execFile('sh', args, (err, stdout, stderr) => {
          if (err) return json(res, 500, { error: String(stderr || err) })
          json(res, 200, { ok: true, file: out })
        })
      } else {
        res.writeHead(404)
        res.end('not found')
      }
    } catch (e) {
      json(res, 500, { error: String(e) })
    }
  })
  .listen(PORT, async () => {
    await build()
    const addr = `http://localhost:${PORT}/?edit`
    console.log(`Editing resume/resume.json at ${addr}  (CV: http://localhost:${PORT}/cv?edit; Ctrl+C to stop)`)
    execFile('open', [addr])
  })
