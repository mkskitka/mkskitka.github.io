// Go through the Visuals one at a time and decide which stay on the site.
//   npm run visuals:review      then http://localhost:5183 (opens by itself)
//   Ctrl+C to stop
//
// Each decision is saved at once into src/data/visuals-review.json: `hidden` is the
// list of post ids kept off the site (src/data/visuals.js filters them out), `kept`
// the ones looked at and approved, so the review can be picked up where it stopped.
// The daily Instagram sync rewrites instagram.json but never touches this file, so
// a post hidden here stays hidden. To put one back, pick Keep on it here (or delete
// its id from the file).
import http from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.PORT) || 5183
const POSTS = path.join(ROOT, 'src', 'data', 'instagram.json')
const REVIEW = path.join(ROOT, 'src', 'data', 'visuals-review.json')
const PUBLIC = path.join(ROOT, 'public')
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4' }

const body = (req) =>
  new Promise((resolve) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  })
const json = (res, code, data) => {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  res.end(JSON.stringify(data))
}
const readReview = async () => {
  try {
    const r = JSON.parse(await readFile(REVIEW, 'utf8'))
    return { hidden: Array.isArray(r.hidden) ? r.hidden : [], kept: Array.isArray(r.kept) ? r.kept : [] }
  } catch {
    return { hidden: [], kept: [] }
  }
}

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Visuals review</title>
<style>
  :root { color-scheme: dark; --bg: #0c0c0e; --fg: #fff; --dim: rgba(255,255,255,.55); --keep: rgb(45,215,205); --drop: rgb(235,70,55); --glass: rgba(255,255,255,.06); }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--fg); font: 15px/1.4 'Open Sans', system-ui, sans-serif; }
  body { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 1fr auto; height: 100vh; overflow: hidden; }
  header, main, footer { min-width: 0; }
  header { display: flex; align-items: baseline; gap: 1.2em; padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,.1); font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
  header .count { color: var(--dim); }
  header .spacer { flex: 1; }
  header label { color: var(--dim); cursor: pointer; display: flex; gap: .5em; align-items: center; text-transform: none; letter-spacing: 0; font-size: 13px; }
  main { display: grid; grid-template-columns: 1fr; justify-items: center; align-content: center; gap: 14px; padding: 16px 20px; min-height: 0; overflow: auto; }
  .frame { position: relative; width: min(100vh - 330px, 92vw); min-width: 240px; aspect-ratio: 1; background: #111; border: 1px solid rgba(255,255,255,.12); display: grid; place-items: center; overflow: hidden; }
  .frame img { width: 100%; height: 100%; object-fit: contain; }
  .frame.kept { border-color: var(--keep); }
  .frame.hidden { border-color: var(--drop); }
  .frame .state { position: absolute; top: 10px; left: 10px; padding: 3px 9px; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; background: rgba(0,0,0,.55); }
  .frame.kept .state { color: var(--keep); } .frame.hidden .state { color: var(--drop); }
  .meta { display: flex; gap: 1.2em; align-items: baseline; color: var(--dim); font-size: 13px; max-width: 92vw; }
  .meta b { color: var(--fg); font-weight: 500; }
  .meta a { color: inherit; }
  .actions { display: flex; gap: 12px; }
  button { font: inherit; letter-spacing: .12em; text-transform: uppercase; font-size: 12px; padding: 12px 22px; border: 1px solid rgba(255,255,255,.2); background: var(--glass); color: var(--fg); cursor: pointer; }
  button:hover { border-color: rgba(255,255,255,.5); }
  button.keep { border-color: var(--keep); } button.keep:hover { background: rgba(45,215,205,.15); }
  button.drop { border-color: var(--drop); } button.drop:hover { background: rgba(235,70,55,.15); }
  button.quiet { color: var(--dim); }
  kbd { font: inherit; opacity: .55; margin-left: .6em; }
  footer { padding: 12px 20px 18px; border-top: 1px solid rgba(255,255,255,.1); }
  .strip { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 6px; scrollbar-width: thin; }
  .strip button { padding: 0; flex: 0 0 auto; width: 52px; height: 52px; border: 2px solid transparent; background: #111; opacity: .55; }
  .strip button img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .strip button.kept { border-color: var(--keep); opacity: .9; }
  .strip button.hidden { border-color: var(--drop); opacity: .9; }
  .strip button.hidden img { filter: grayscale(1) brightness(.6); }
  .strip button.current { outline: 2px solid #fff; outline-offset: 1px; opacity: 1; }
  .done { text-align: center; color: var(--dim); }
  .saved { color: var(--dim); font-size: 12px; min-width: 6em; text-align: right; }
  .saved.err { color: var(--drop); }
</style>
</head>
<body>
<header>
  <span>Visuals review</span>
  <span class="count" id="count"></span>
  <span class="spacer"></span>
  <label><input type="checkbox" id="onlyNew" checked> Only the ones not decided yet</label>
  <span class="saved" id="saved"></span>
</header>
<main>
  <div class="frame" id="frame"><img id="img" alt=""><span class="state" id="state"></span></div>
  <div class="meta"><b id="title"></b><span id="date"></span><a id="link" target="_blank" rel="noreferrer">Instagram ↗</a></div>
  <div class="actions">
    <button class="drop" id="btnDrop">Remove<kbd>←</kbd></button>
    <button class="quiet" id="btnSkip">Skip<kbd>↓</kbd></button>
    <button class="keep" id="btnKeep">Keep<kbd>→</kbd></button>
  </div>
  <div class="actions"><button class="quiet" id="btnUndo">Undo last<kbd>U</kbd></button></div>
</main>
<footer><div class="strip" id="strip"></div></footer>
<script>
  let items = [], review = { hidden: [], kept: [] }, at = 0, history = []
  const $ = (id) => document.getElementById(id)
  const stateOf = (id) => review.hidden.includes(id) ? 'hidden' : review.kept.includes(id) ? 'kept' : ''
  const fmt = (t) => t ? new Date(t).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''

  async function load() {
    const d = await (await fetch('/data')).json()
    items = d.items; review = d.review
    const first = items.findIndex((v) => !stateOf(v.id))
    at = first < 0 ? 0 : first
    render()
  }
  async function save() {
    $('saved').textContent = 'saving…'; $('saved').className = 'saved'
    try {
      const r = await fetch('/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(review) })
      if (!r.ok) throw new Error(await r.text())
      $('saved').textContent = 'saved'
    } catch (e) { $('saved').textContent = 'not saved'; $('saved').className = 'saved err'; console.error(e) }
  }
  function decide(state) {
    const v = items[at]; if (!v) return
    history.push({ id: v.id, hidden: review.hidden.slice(), kept: review.kept.slice(), at })
    review.hidden = review.hidden.filter((id) => id !== v.id)
    review.kept = review.kept.filter((id) => id !== v.id)
    if (state === 'hidden') review.hidden.push(v.id)
    if (state === 'kept') review.kept.push(v.id)
    save()
    next()
  }
  function next() {
    const onlyNew = $('onlyNew').checked
    for (let i = at + 1; i < items.length; i++) if (!onlyNew || !stateOf(items[i].id)) { at = i; return render() }
    if (onlyNew) { const first = items.findIndex((v) => !stateOf(v.id)); if (first >= 0) { at = first; return render() } }
    render()
  }
  function undo() {
    const h = history.pop(); if (!h) return
    review.hidden = h.hidden; review.kept = h.kept; at = h.at
    save(); render()
  }
  function render() {
    const v = items[at]
    const decided = items.filter((x) => stateOf(x.id)).length
    $('count').textContent = (at + 1) + ' of ' + items.length + '  ·  ' + decided + ' decided  ·  ' + review.hidden.length + ' removed'
    if (!v) return
    $('img').src = v.image; $('img').alt = v.title || ''
    $('title').textContent = v.title || 'Untitled'
    $('date').textContent = fmt(v.timestamp)
    $('link').href = v.url || '#'
    const s = stateOf(v.id)
    $('frame').className = 'frame ' + s
    $('state').textContent = s === 'hidden' ? 'Removed' : s === 'kept' ? 'Kept' : 'Undecided'
    const strip = $('strip'); strip.innerHTML = ''
    items.forEach((x, i) => {
      const b = document.createElement('button')
      b.className = stateOf(x.id) + (i === at ? ' current' : '')
      b.title = x.title || ''
      const im = document.createElement('img'); im.src = x.image; im.loading = 'lazy'; b.appendChild(im)
      b.onclick = () => { at = i; render() }
      strip.appendChild(b)
    })
    const cur = strip.children[at]; if (cur) strip.scrollTo({ left: cur.offsetLeft - strip.clientWidth / 2 + cur.offsetWidth / 2, behavior: 'smooth' })
  }
  $('btnKeep').onclick = () => decide('kept')
  $('btnDrop').onclick = () => decide('hidden')
  $('btnSkip').onclick = () => next()
  $('btnUndo').onclick = undo
  $('onlyNew').onchange = () => render()
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return
    if (e.key === 'ArrowRight' || e.key === 'k' || e.key === 'K') decide('kept')
    else if (e.key === 'ArrowLeft' || e.key === 'r' || e.key === 'R' || e.key === 'Backspace') { e.preventDefault(); decide('hidden') }
    else if (e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); next() }
    else if (e.key === 'ArrowUp') { if (at > 0) { at--; render() } }
    else if (e.key === 'u' || e.key === 'U') undo()
  })
  load()
</script>
</body>
</html>
`

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`)
    try {
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        res.end(PAGE)
      } else if (req.method === 'GET' && url.pathname === '/data') {
        const items = JSON.parse(await readFile(POSTS, 'utf8'))
        json(res, 200, { items, review: await readReview() })
      } else if (req.method === 'POST' && url.pathname === '/save') {
        const r = JSON.parse(await body(req))
        if (!Array.isArray(r.hidden) || !Array.isArray(r.kept)) return json(res, 400, { error: 'bad save payload' })
        const clean = (a) => [...new Set(a.filter((id) => typeof id === 'string'))]
        await writeFile(REVIEW, JSON.stringify({ hidden: clean(r.hidden), kept: clean(r.kept) }, null, 2) + '\n')
        json(res, 200, { ok: true, file: REVIEW })
      } else if (req.method === 'GET' && url.pathname.startsWith('/images/')) {
        const file = path.normalize(path.join(PUBLIC, decodeURIComponent(url.pathname)))
        const ext = path.extname(file).toLowerCase()
        if (!file.startsWith(PUBLIC + path.sep) || !TYPES[ext]) {
          res.writeHead(404)
          return res.end('not found')
        }
        const data = await readFile(file)
        res.writeHead(200, { 'content-type': TYPES[ext], 'cache-control': 'max-age=3600' })
        res.end(data)
      } else {
        res.writeHead(404)
        res.end('not found')
      }
    } catch (e) {
      json(res, 500, { error: String(e) })
    }
  })
  .listen(PORT, () => {
    const addr = `http://localhost:${PORT}/`
    console.log(`Reviewing the visuals at ${addr}  (decisions go to src/data/visuals-review.json; Ctrl+C to stop)`)
    execFile('open', [addr])
  })
