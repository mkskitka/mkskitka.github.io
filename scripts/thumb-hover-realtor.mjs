#!/usr/bin/env node
// The Realtor tile's hover clip, drawn from its thumbnail: the clouds on the cabinet's
// screen drift right and THANKS FOR PLAYING blinks, with the thumbnail's transparent
// background kept. Renders PNG frames, which become the transparent clip pair with:
//   node scripts/thumb-hover-realtor.mjs <frames-dir>
//   ffmpeg -framerate 30 -i <frames-dir>/%04d.png -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 32 -auto-alt-ref 0 -an src/assets/projects/realtor-savings-simulator/thumb-hover.webm
//   ffmpeg -framerate 30 -i <frames-dir>/%04d.png -c:v hevc_videotoolbox -pix_fmt bgra -alpha_quality 0.8 -q:v 60 -tag:v hvc1 -an -movflags +faststart src/assets/projects/realtor-savings-simulator/thumb-hover.mp4
// (VP9 for Chrome and Firefox, HEVC for Safari; src/data/media.js treats the pair as a clip with alpha.)
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
const [,, outDir, only] = process.argv
const src = 'src/assets/projects/realtor-savings-simulator/thumb.png'
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const W = info.width, H = info.height
const px = (x, y) => (y * W + x) * 4
const clamp8 = (v) => Math.max(0, Math.min(255, Math.round(v)))
const sat = (i) => { const r = data[i], g = data[i + 1], b = data[i + 2]; const m = Math.max(r, g, b); return m ? (m - Math.min(r, g, b)) / m : 0 }
// Screen-like pixels: the sky's strong blue, or a cloud (pale and bright). The bezel is
// dark grey. Each row's screen runs from its first screen-like pixel to its last (scanning
// from x=252, past the cabinet's blue side art); rows at the bottom are cut short on the
// right by the slanted bezel, which is right.
const isBlue = (i) => data[i + 2] > 110 && data[i + 2] > data[i] + 40 && data[i + 3] > 200
const isCloud = (i) => Math.max(data[i], data[i + 1], data[i + 2]) > 150 && sat(i) < 0.45
const edges = new Map()
for (let y = 262; y <= 540; y++) {
  let first = -1, last = -1, n = 0
  for (let x = 252; x <= 622; x++) { const i = px(x, y); if (isBlue(i) || isCloud(i)) { if (first < 0) first = x; last = x; n++ } }
  if (first < 0 || n / (last + 1 - first) < 0.5 || last + 1 - first < 60) continue
  edges.set(y, [first, last + 1])
}
const inScreen = (x, y) => { const e = edges.get(y); return !!e && x >= e[0] && x < e[1] }
const BAND_Y0 = 462 // clouds live below this
const QR = { x0: 426, x1: 474, y0: 464, y1: 512 } // left alone (its white would read as cloud)
const TEXT = { x0: 330, x1: 516, y0: 308, y1: 336 } // THANKS FOR PLAYING
const FPS = 30, SECONDS = 6, BLINK = 0.5 // s on, s off
const inQR = (x, y) => x >= QR.x0 && x < QR.x1 && y >= QR.y0 && y < QR.y1
// The wrap period: the screen's full width (its widest row); a row cut short by the
// bottom bezel still wraps on the full width, so cloud columns stay straight.
let fullW = 0
for (const [l, r] of edges.values()) fullW = Math.max(fullW, r - l)
// Cloud alpha from saturation, soft edged.
const cloudA = (i) => Math.min(1, Math.max(0, (0.45 - sat(i)) / 0.25))
// Sky colour per row: the median of the row's cloud-free screen pixels (outside the QR);
// a row that is all cloud takes the row above.
const sky = new Map()
const median = (arr) => { arr.sort((a, b) => a - b); return arr[arr.length >> 1] }
let last = null
for (const [y, [l, r]] of edges) {
  const cr = [], cg = [], cb = []
  for (let x = l; x < r; x++) {
    if (inQR(x, y)) continue
    const i = px(x, y)
    if (cloudA(i) > 0) continue
    cr.push(data[i]); cg.push(data[i + 1]); cb.push(data[i + 2])
  }
  if (cr.length > 20) last = [median(cr), median(cg), median(cb)]
  if (last) sky.set(y, last)
}
// The cloud layer: each cloud pixel's own colour (unmixed from the sky behind its soft edge,
// so laid back over the sky it gives the original exactly) + alpha; the background has the
// sky where the clouds were.
const cloud = Buffer.alloc(W * H * 4)
const back = Buffer.from(data)
for (const [y, [l, r]] of edges) {
  if (y < BAND_Y0) continue
  const s = sky.get(y)
  if (!s) continue
  for (let x = l; x < r; x++) {
    if (inQR(x, y)) continue
    const i = px(x, y)
    const a = cloudA(i)
    if (a <= 0) continue
    for (let c = 0; c < 3; c++) cloud[i + c] = clamp8((data[i + c] - s[c] * (1 - a)) / a)
    cloud[i + 3] = Math.round(a * 255)
    back[i] = s[0]; back[i + 1] = s[1]; back[i + 2] = s[2]
  }
}
// The text's off state: each row filled by a run from the sky just left of the box to the
// sky just right of it, so the gradient across the screen carries through.
const textFill = new Map()
for (let y = TEXT.y0; y < TEXT.y1; y++) {
  const avg = (x0, x1) => { const o = [0, 0, 0]; let n = 0; for (let x = x0; x < x1; x++) { const i = px(x, y); o[0] += data[i]; o[1] += data[i + 1]; o[2] += data[i + 2]; n++ } return o.map((v) => v / n) }
  textFill.set(y, [avg(TEXT.x0 - 8, TEXT.x0), avg(TEXT.x1, TEXT.x1 + 8)])
}
mkdirSync(outDir, { recursive: true })
const total = FPS * SECONDS
const frames = only != null ? [Number(only)] : [...Array(total).keys()]
for (const f of frames) {
  const t = f / FPS
  const out = Buffer.from(back)
  const dx = Math.round((t / SECONDS) * fullW) // one full width per loop: seamless
  for (const [y, [l, r]] of edges) {
    if (y < BAND_Y0 || !sky.get(y)) continue
    for (let x = l; x < r; x++) {
      if (inQR(x, y)) continue
      // the cloud pixel that has moved here: from dx to the left, wrapped on the full width
      const sx = l + ((((x - dx - l) % fullW) + fullW) % fullW)
      if (sx >= r) continue // behind the bezel on this row: nothing there
      const j = px(sx, y)
      const a = cloud[j + 3] / 255
      if (a <= 0) continue
      const i = px(x, y)
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(cloud[j + c] * a + out[i + c] * (1 - a))
    }
  }
  const textOn = Math.floor(t / BLINK) % 2 === 0
  if (!textOn) {
    for (let y = TEXT.y0; y < TEXT.y1; y++) {
      const [lc, rc] = textFill.get(y)
      for (let x = TEXT.x0; x < TEXT.x1; x++) {
        const k = (x - TEXT.x0) / (TEXT.x1 - TEXT.x0)
        const i = px(x, y)
        for (let c = 0; c < 3; c++) out[i + c] = clamp8(lc[c] + (rc[c] - lc[c]) * k)
      }
    }
  }
  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(`${outDir}/${String(f).padStart(4, '0')}.png`)
}
console.log(`${frames.length} frame(s) -> ${outDir} (screen rows ${Math.min(...edges.keys())}-${Math.max(...edges.keys())}, width ${fullW})`)
