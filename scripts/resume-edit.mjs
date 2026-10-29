// Edit the resume in the browser: serves resume/resume.html with edit mode on,
// saves the page back to that file, and exports the PDF on request.
//   npm run resume:edit     (Ctrl+C to stop)
import http from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = path.join(ROOT, 'resume', 'resume.html')
const PORT = 5181

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

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`)
    try {
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/resume.html')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        res.end(await readFile(FILE, 'utf8'))
      } else if (req.method === 'POST' && url.pathname === '/save') {
        // Splice the edited page contents between the markers; the rest of the
        // file (styles, script) is left exactly as it is.
        const { page } = JSON.parse(await body(req))
        if (typeof page !== 'string' || !page.includes('class="head')) {
          return json(res, 400, { error: 'that does not look like the resume page; not saved' })
        }
        const file = await readFile(FILE, 'utf8')
        const START = '<!-- page:start -->'
        const END = '<!-- page:end -->'
        const a = file.indexOf(START)
        const b = file.indexOf(END)
        if (a < 0 || b < 0 || b < a) return json(res, 400, { error: 'page markers missing in resume.html; not saved' })
        const inner = page.replace(START, '').replace(END, '').trim()
        await writeFile(FILE, file.slice(0, a + START.length) + '\n    ' + inner + '\n    ' + file.slice(b))
        json(res, 200, { ok: true, file: FILE })
      } else if (req.method === 'POST' && url.pathname === '/export') {
        const { theme } = JSON.parse((await body(req)) || '{}')
        const stamp = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }).replace('/', '_')
        const out = path.join(process.env.HOME, 'Desktop', `MK_Skitka_Resume_${stamp}${theme === 'light' ? '_light' : ''}.pdf`)
        const args = [path.join(ROOT, 'scripts', 'resume-pdf.sh'), out]
        if (theme === 'light') args.push('light')
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
  .listen(PORT, () => {
    const addr = `http://localhost:${PORT}/?edit`
    console.log(`Editing ${path.relative(ROOT, FILE)} at ${addr}  (Ctrl+C to stop)`)
    execFile('open', [addr])
  })
